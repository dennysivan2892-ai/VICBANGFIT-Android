VICBANGFIT ANDROID + FIREBASE CLOUD MESSAGING

Identidad Android
- package/applicationId: com.vicbangfit.app
- Firebase project: vicbangfit
- Firebase project number: 557201296463
- Firebase mobile app id: 1:557201296463:android:d1edb7b85b239584c32e3a

QuÃ© incluye
- Proyecto Capacitor preparado para Android.
- google-services.json colocado en android/app/google-services.json.
- @capacitor/push-notifications.
- Solicitud de permiso de notificaciones.
- Registro del token FCM.
- Guardado del token en public.push_tokens de Supabase.
- Refresco de notificaciones in-app al recibir un push.
- Manejo bÃ¡sico al tocar una notificaciÃ³n.
- Nunca incluye una clave Firebase de cuenta de servicio.

IMPORTANTE
El archivo google-services.json NO es la credencial que permite enviar mensajes
desde el servidor. Para enviar push desde Supabase/Edge Functions hace falta
autenticaciÃ³n servidor FCM HTTP v1, guardada como secreto del servidor.
No pongas una service account/private key en index.html, JavaScript, GitHub pÃºblico
ni dentro del APK.

CÃ³mo generar el proyecto Android completo en un ordenador
1. Instala Node.js y Android Studio.
2. Abre una terminal en esta carpeta.
3. Ejecuta: npm install
4. Ejecuta: npm run build
5. Si android/ aÃºn no contiene el proyecto nativo generado:
   - guarda temporalmente android/app/google-services.json
   - ejecuta npx cap add android
   - vuelve a colocar google-services.json en android/app/
6. Ejecuta: npx cap sync android
7. Ejecuta: npx cap open android
8. En Android Studio, conecta tu mÃ³vil y pulsa Run.

Prueba FCM
- Inicia sesiÃ³n en VICBANGFIT en el mÃ³vil.
- Acepta notificaciones.
- El token FCM se guarda en public.push_tokens.
- En Firebase Console > Messaging, puedes enviar una notificaciÃ³n de prueba al token.

Siguiente fase servidor
- Crear una Supabase Edge Function para FCM HTTP v1.
- Guardar la credencial de servidor Firebase como secreto de Supabase.
- Disparar la Edge Function cuando se cree una notificaciÃ³n PR.
