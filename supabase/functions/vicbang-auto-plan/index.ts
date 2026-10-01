import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });
const norm = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const round5 = (n: number, min: number, max: number) => clamp(Math.round(n / 5) * 5, min, max);

function ageFromBirthDate(value: unknown) {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age--;
  return age > 0 ? age : null;
}
function activityFactor(v: unknown) {
  const a = norm(v);
  if (a.includes("muy sedent")) return 1.2;
  if (a.includes("sedent")) return 1.375;
  if (a.includes("muy activa") || a.includes("muy activo")) return 1.9;
  if (a.includes("activa") || a.includes("activo")) return 1.725;
  return 1.55;
}
function goalKind(v: unknown) {
  const g = norm(v);
  const muscle = g.includes("masa") || g.includes("muscul") || g.includes("hipertrof") || g.includes("ganancia");
  const lean = g.includes("defin") || g.includes("grasa") || g.includes("adelgaz") || g.includes("peso");
  if (g.includes("recom") || (muscle && lean)) return "recomp";
  if (lean) return "fatloss";
  if (muscle) return "muscle";
  if (g.includes("fuerza")) return "strength";
  if (g.includes("rendimiento") || g.includes("performance") || g.includes("resistencia")) return "performance";
  return "general";
}
function calcTargets(profile: any) {
  const age = num(profile.age_years), weight = num(profile.weight_kg), height = num(profile.height_cm);
  const sex = String(profile.sex || "");
  if (!age || !weight || !height || !sex) return null;
  const constant = sex === "female" ? -161 : sex === "male" ? 5 : -78;
  const bmr = 10 * weight + 6.25 * height - 5 * age + constant;
  const af = activityFactor(profile.daily_activity);
  const maintenance = bmr * af;
  const kind = goalKind(profile.primary_goal);
  const adj = age < 18 ? 0 : ({ fatloss: -15, recomp: -5, muscle: 10, strength: 5, performance: 5, general: 0 } as Record<string, number>)[kind] ?? 0;
  const target = maintenance * (1 + adj / 100);
  const macro = kind === "fatloss" ? { p: 2.2, f: 0.8 } : kind === "recomp" ? { p: 2.0, f: 0.9 } : { p: 1.8, f: 0.9 };
  const protein = Math.round(weight * macro.p);
  const fat = Math.round(weight * macro.f);
  const carbs = Math.max(0, Math.round((target - protein * 4 - fat * 9) / 4));
  return {
    age, weight, height, sex, kind, activityFactor: af,
    bmr: Math.round(bmr), maintenance: Math.round(maintenance), targetCalories: Math.round(target / 10) * 10,
    adjustment: adj, protein, carbs, fat,
  };
}
function extractNutritionProfile(raw: unknown) {
  const empty = { diet_style: "", allergies: "", intolerances: "", avoid: "", preferences: "" };
  const s = String(raw ?? "");
  const m = s.match(/\[\[VICBANGFIT_NUTRITION_PROFILE\]\]\s*([\s\S]*?)\s*\[\[\/VICBANGFIT_NUTRITION_PROFILE\]\]/i);
  if (!m) return empty;
  try { return { ...empty, ...(JSON.parse(m[1]) || {}) }; } catch { return empty; }
}
function blockedBlob(profile: any) {
  return norm(`${profile?.allergies || ""} ${profile?.intolerances || ""} ${profile?.avoid || ""}`);
}
const foods: Record<string, { p: number; c: number; f: number; min: number; max: number; aliases?: string[] }> = {
  "Avena": { p: 13, c: 60, f: 7, min: 30, max: 120 },
  "Arroz en crudo": { p: 7, c: 78, f: 1, min: 40, max: 160 },
  "Patata": { p: 2, c: 17, f: 0.1, min: 120, max: 500 },
  "Pan integral": { p: 10, c: 43, f: 4, min: 40, max: 180 },
  "Pasta en crudo": { p: 13, c: 72, f: 2, min: 40, max: 160 },
  "Quinoa en crudo": { p: 14, c: 64, f: 6, min: 40, max: 150 },
  "Boniato": { p: 1.6, c: 20, f: 0.1, min: 120, max: 450 },
  "Claras de huevo": { p: 11, c: 1, f: 0.2, min: 120, max: 450, aliases: ["huevo"] },
  "Pechuga de pollo": { p: 23, c: 0, f: 2, min: 80, max: 300 },
  "Pechuga de pavo": { p: 22, c: 1, f: 2, min: 80, max: 300 },
  "Atún al natural": { p: 24, c: 0, f: 1, min: 80, max: 250, aliases: ["atun"] },
  "Pescado blanco": { p: 20, c: 0, f: 2, min: 100, max: 320 },
  "Salmón": { p: 20, c: 0, f: 13, min: 90, max: 260, aliases: ["salmon"] },
  "Tofu": { p: 13, c: 2, f: 8, min: 100, max: 350 },
  "Lentejas cocidas": { p: 9, c: 20, f: 0.4, min: 120, max: 400, aliases: ["lenteja"] },
  "Aceite de oliva virgen extra": { p: 0, c: 0, f: 100, min: 5, max: 30, aliases: ["aceite"] },
  "Almendras": { p: 21, c: 22, f: 50, min: 10, max: 45, aliases: ["almendra", "frutos secos"] },
  "Nueces": { p: 15, c: 14, f: 65, min: 10, max: 40, aliases: ["nuez", "frutos secos"] },
  "Crema de cacahuete": { p: 25, c: 20, f: 50, min: 10, max: 45, aliases: ["cacahuete", "mani"] },
  "Aguacate": { p: 2, c: 9, f: 15, min: 30, max: 150 },
  "Plátano": { p: 1.1, c: 23, f: 0.3, min: 100, max: 220, aliases: ["platano"] },
  "Manzana": { p: 0.3, c: 14, f: 0.2, min: 120, max: 220 },
  "Naranja": { p: 0.9, c: 12, f: 0.1, min: 120, max: 250 },
  "Frutos rojos": { p: 1, c: 12, f: 0.5, min: 80, max: 200 },
  "Ensalada variada": { p: 2, c: 6, f: 0.3, min: 150, max: 300 },
  "Brócoli": { p: 2.8, c: 7, f: 0.4, min: 150, max: 300, aliases: ["brocoli"] },
  "Verduras variadas": { p: 2, c: 7, f: 0.4, min: 150, max: 300 },
};
function foodBlocked(name: string, profile: any) {
  const blob = blockedBlob(profile);
  if (!blob) return false;
  const f = foods[name];
  return [name, ...(f?.aliases || [])].some(x => blob.includes(norm(x)));
}
function choose(names: string[], used: Set<string>, profile: any) {
  const safe = names.filter(n => foods[n] && !foodBlocked(n, profile));
  const unique = safe.find(n => !used.has(n));
  const pick = unique || safe[0] || names.find(n => foods[n])!;
  if (pick) used.add(pick);
  return pick;
}
function macroLine(name: string, grams: number) {
  const f = foods[name];
  const p = f.p * grams / 100, c = f.c * grams / 100, fat = f.f * grams / 100;
  return { food_name: name, amount: grams, unit: "g", protein_g: Math.round(p * 10) / 10, carbs_g: Math.round(c * 10) / 10, fat_g: Math.round(fat * 10) / 10, calories: Math.round(p * 4 + c * 4 + fat * 9) };
}
function buildNutritionMeals(calc: any, profile: any) {
  const style = norm(profile?.diet_style);
  const vegan = style.includes("vegan");
  const vegetarian = vegan || style.includes("vegetar");
  const pesc = style.includes("pescetar");
  const proteinPool = vegan ? ["Tofu", "Lentejas cocidas"] : vegetarian ? ["Claras de huevo", "Tofu", "Lentejas cocidas"] : pesc ? ["Claras de huevo", "Atún al natural", "Pescado blanco", "Salmón", "Tofu"] : ["Claras de huevo", "Pechuga de pollo", "Pechuga de pavo", "Atún al natural", "Pescado blanco", "Salmón", "Tofu"];
  const carbPool = ["Avena", "Arroz en crudo", "Pan integral", "Patata", "Pasta en crudo", "Quinoa en crudo", "Boniato"];
  const fatPool = ["Crema de cacahuete", "Aceite de oliva virgen extra", "Almendras", "Nueces", "Aguacate"];
  const producePool = ["Plátano", "Brócoli", "Manzana", "Ensalada variada", "Naranja", "Verduras variadas", "Frutos rojos"];
  const usedP = new Set<string>(), usedC = new Set<string>(), usedF = new Set<string>(), usedX = new Set<string>();
  const names = ["Desayuno", "Comida", "Merienda", "Cena"], times = ["08:00", "14:00", "18:00", "21:00"], splits = [0.25, 0.35, 0.15, 0.25];
  return names.map((name, i) => {
    const pTarget = calc.protein * splits[i], cTarget = calc.carbs * splits[i], fTarget = calc.fat * splits[i];
    const proteinName = choose(proteinPool, usedP, profile);
    const carbName = choose(carbPool, usedC, profile);
    const fatName = choose(fatPool, usedF, profile);
    const produceName = choose(producePool, usedX, profile);
    const produceG = produceName.includes("Brócoli") || produceName.includes("Ensalada") || produceName.includes("Verduras") ? 200 : 150;
    const prod = macroLine(produceName, produceG);
    const carbF = foods[carbName], protF = foods[proteinName], fatF = foods[fatName];
    const carbG = round5(Math.max(0, cTarget - prod.carbs_g) / Math.max(0.01, carbF.c / 100), carbF.min, carbF.max);
    const carb = macroLine(carbName, carbG);
    const proteinG = round5(Math.max(0, pTarget - prod.protein_g - carb.protein_g) / Math.max(0.01, protF.p / 100), protF.min, protF.max);
    const protein = macroLine(proteinName, proteinG);
    const fatNeed = Math.max(0, fTarget - prod.fat_g - carb.fat_g - protein.fat_g);
    const fatG = round5(fatNeed / Math.max(0.01, fatF.f / 100), fatF.min, fatF.max);
    const fat = macroLine(fatName, fatG);
    return { name, target_time: times[i], notes: `Objetivo aproximado: ${Math.round(pTarget)} g proteína · ${Math.round(cTarget)} g carbohidratos · ${Math.round(fTarget)} g grasa`, foods: [prod, carb, protein, fat] };
  });
}
function trainingLevel(v: unknown) {
  const x = norm(v); if (x.includes("avanz")) return "advanced"; if (x.includes("inter")) return "intermediate"; return "beginner";
}
function recommendedDays(available: unknown, level: string) {
  let d = Number(available) || 3; d = level === "beginner" ? Math.min(d, 4) : level === "intermediate" ? Math.min(d, 5) : Math.min(d, 6); return clamp(d, 1, 6);
}
function split(days: number) {
  const s: Record<number, [string, string[]][]> = {
    1: [["Full body", ["Pecho","Espalda","Cuádriceps","Femoral","Hombros"]]],
    2: [["Full body A", ["Pecho","Espalda","Cuádriceps","Femoral","Hombros"]],["Full body B",["Espalda","Pecho","Glúteos","Cuádriceps","Bíceps","Tríceps"]]],
    3: [["Torso",["Pecho","Espalda","Hombros","Bíceps","Tríceps"]],["Pierna",["Cuádriceps","Femoral","Glúteos","Gemelos","Abdominales"]],["Full body",["Pecho","Espalda","Cuádriceps","Femoral","Hombros"]]],
    4: [["Torso A",["Pecho","Espalda","Hombros","Bíceps","Tríceps"]],["Pierna A",["Cuádriceps","Femoral","Glúteos","Gemelos"]],["Torso B",["Espalda","Pecho","Hombros","Bíceps","Tríceps"]],["Pierna B",["Femoral","Cuádriceps","Glúteos","Gemelos","Abdominales"]]],
    5: [["Torso",["Pecho","Espalda","Hombros","Bíceps","Tríceps"]],["Pierna",["Cuádriceps","Femoral","Glúteos","Gemelos"]],["Empuje",["Pecho","Hombros","Tríceps"]],["Tirón",["Espalda","Bíceps"]],["Pierna 2",["Femoral","Cuádriceps","Glúteos","Gemelos","Abdominales"]]],
    6: [["Empuje A",["Pecho","Hombros","Tríceps"]],["Tirón A",["Espalda","Bíceps"]],["Pierna A",["Cuádriceps","Femoral","Glúteos","Gemelos"]],["Empuje B",["Pecho","Hombros","Tríceps"]],["Tirón B",["Espalda","Bíceps"]],["Pierna B",["Femoral","Cuádriceps","Glúteos","Gemelos","Abdominales"]]],
  };
  return s[days] || s[3];
}
function prescription(kind: string, level: string) {
  if (kind === "strength") return { sets: level === "beginner" ? 3 : 4, min: 4, max: 8, rir: 2, rest: 150 };
  if (kind === "muscle" || kind === "recomp") return { sets: level === "beginner" ? 3 : 4, min: 6, max: 15, rir: 2, rest: 90 };
  if (kind === "fatloss") return { sets: 3, min: 8, max: 15, rir: 2, rest: 75 };
  return { sets: 3, min: 6, max: 12, rir: 2, rest: 90 };
}
function sessionExerciseCount(minutes: unknown, muscleCount: number) { const m = Number(minutes) || 60; return Math.min(m <= 45 ? 4 : m <= 60 ? 5 : 6, muscleCount); }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization") || "";
    if (!auth) return json({ error: "No autorizado" }, 401);
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Sesión inválida" }, 401);
    const callerId = userData.user.id;
    const body = await req.json().catch(() => ({}));
    const requestedClientId = String(body?.client_id || callerId);
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: link, error: linkErr } = await admin.from("trainer_clients").select("trainer_id,client_id,status").eq("client_id", requestedClientId).eq("status", "active").limit(1).maybeSingle();
    if (linkErr) throw linkErr;
    if (!link) return json({ error: "El cliente no tiene entrenador activo" }, 400);
    if (callerId !== requestedClientId && callerId !== link.trainer_id) return json({ error: "No autorizado para este cliente" }, 403);
    const clientId = requestedClientId, trainerId = link.trainer_id;

    const [oRes, dRes, cRes] = await Promise.all([
      admin.from("client_onboarding_assessments").select("*").eq("trainer_id", trainerId).eq("client_id", clientId).maybeSingle(),
      admin.from("client_details").select("*").eq("user_id", clientId).maybeSingle(),
      admin.from("checkins").select("*").eq("trainer_id", trainerId).eq("client_id", clientId).order("checkin_date", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (oRes.error) throw oRes.error; if (dRes.error) throw dRes.error; if (cRes.error) throw cRes.error;
    const o: any = oRes.data || {}, d: any = dRes.data || {}, c: any = cRes.data || {};
    const merged: any = { ...o };
    merged.trainer_id = trainerId; merged.client_id = clientId;
    merged.age_years = num(o.age_years) || ageFromBirthDate(d.birth_date);
    merged.sex = o.sex || d.sex || null;
    merged.height_cm = num(o.height_cm) || num(d.height_cm);
    merged.weight_kg = num(c.weight_kg) || num(o.weight_kg) || num(d.current_weight_kg);
    merged.sleep_hours = num(c.sleep_hours) || num(o.sleep_hours);
    merged.primary_goal = o.primary_goal || d.goal || null;
    const calc = calcTargets(merged);
    const profile = extractNutritionProfile(merged.additional_notes);
    const trainingReady = !!(merged.primary_goal && merged.training_experience && num(merged.days_per_week) && num(merged.session_minutes));
    const baseReady = !!(merged.age_years && merged.sex && merged.height_cm && merged.weight_kg && merged.primary_goal && merged.daily_activity);
    const completionReady = baseReady && trainingReady;
    const now = new Date().toISOString();
    const recommendations = calc ? {
      general: `Objetivo ${merged.primary_goal}. Seguimiento semanal con peso, cintura, energía, hambre, sueño y rendimiento.`,
      nutrition: `${calc.targetCalories} kcal/día · ${calc.protein} g proteína · ${calc.carbs} g carbohidratos · ${calc.fat} g grasas. Ajustar según evolución y adherencia.`,
      training: trainingReady ? `${recommendedDays(merged.days_per_week, trainingLevel(merged.training_experience))} días/semana, adaptados a ${merged.session_minutes} min por sesión y al nivel ${merged.training_experience}.` : "Faltan experiencia, días o tiempo por sesión.",
      supplementation: "Revisar suplementación de forma individual según alimentación, tolerancia, medicación, antecedentes y objetivos.",
      warnings: [profile.allergies ? `Alergias declaradas: ${profile.allergies}` : "", merged.limitations && !norm(merged.limitations).includes("ningun") ? `Limitaciones declaradas: ${merged.limitations}` : ""].filter(Boolean),
    } : {};
    const onboardingPatch: any = { ...merged, updated_at: now };
    if (completionReady) { onboardingPatch.status = "completed"; onboardingPatch.completed_at = o.completed_at || now; }
    if (calc) Object.assign(onboardingPatch, { activity_factor: calc.activityFactor, bmr_kcal: calc.bmr, maintenance_kcal: calc.maintenance, target_calories: calc.targetCalories, target_protein_g: calc.protein, target_carbs_g: calc.carbs, target_fat_g: calc.fat, calorie_adjustment_pct: calc.adjustment, recommendation_json: recommendations, recommendations_generated_at: now });
    const { data: savedAssessment, error: saveErr } = await admin.from("client_onboarding_assessments").upsert(onboardingPatch, { onConflict: "trainer_id,client_id" }).select().single();
    if (saveErr) throw saveErr;
    const detailPatch: any = { user_id: clientId, sex: merged.sex || null, height_cm: merged.height_cm || null, current_weight_kg: merged.weight_kg || null, waist_cm: num(c.waist_cm) || num(d.waist_cm), goal: merged.primary_goal || null, updated_at: now };
    const { error: detailErr } = await admin.from("client_details").upsert(detailPatch, { onConflict: "user_id" }); if (detailErr) throw detailErr;

    const missing: string[] = [];
    if (!merged.age_years) missing.push("edad"); if (!merged.sex) missing.push("sexo"); if (!merged.height_cm) missing.push("altura"); if (!merged.weight_kg) missing.push("peso"); if (!merged.primary_goal) missing.push("objetivo"); if (!merged.daily_activity) missing.push("actividad diaria");
    let nutritionAction = "pending", routineAction = "pending";

    // Recommendations are reviewed and assigned exclusively by the linked trainer.
    // Never create active plans or modify an assigned plan from a client check-in.
    nutritionAction = calc ? "pending_trainer_review" : "pending";
    routineAction = trainingReady ? "pending_trainer_review" : "pending";

    return json({ ok: true, client_id: clientId, assessment_status: savedAssessment?.status, missing, targets: calc ? { calories: calc.targetCalories, protein: calc.protein, carbs: calc.carbs, fat: calc.fat } : null, nutrition: nutritionAction, routine: routineAction });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Error generando el plan automático" }, 500);
  }
});
