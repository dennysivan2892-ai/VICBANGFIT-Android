import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

function getSb() {
  return window.VICBANGFIT_SB || window.sb || null;
}

async function saveToken(token) {
  const sb = getSb();

  if (!sb) {
    console.warn('Supabase todavía no está disponible');
    return;
  }

  const {
    data: { user },
    error: userError
  } = await sb.auth.getUser();

  if (userError || !user) {
    console.warn('No hay usuario autenticado para guardar el token FCM');
    return;
  }

  const payload = {
    user_id: user.id,
    token: token,
    platform: 'android',
    device_name: navigator.userAgent.slice(0, 120),
    app_version: '1.0.0',
    enabled: true,
    last_seen_at: new Date().toISOString()
  };

  const { error } = await sb
    .from('push_tokens')
    .upsert(payload, {
      onConflict: 'token'
    });

  if (error) {
    console.error('Error guardando token FCM:', error);
  } else {
    console.log('Token FCM guardado correctamente en Supabase');
  }
}

export async function initVicbangfitPush() {
  if (window.__vicbangfitPushInitialized) {
    return;
  }
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  if (Capacitor.getPlatform() !== 'android') {
    return;
  }

  let permission = await PushNotifications.checkPermissions();

  if (permission.receive === 'prompt') {
    permission = await PushNotifications.requestPermissions();
  }

  if (permission.receive !== 'granted') {
    console.warn('Permiso de notificaciones no concedido');
    return;
  }

  window.__vicbangfitPushInitialized = true;

  await PushNotifications.addListener(
    'registration',
    async token => {
      console.log('FCM token recibido');
      await saveToken(token.value);
    }
  );

  await PushNotifications.addListener(
    'registrationError',
    error => {
      console.error('Error registrando FCM:', error);
    }
  );

  await PushNotifications.addListener(
    'pushNotificationReceived',
    notification => {
      console.log('Notificación recibida:', notification);

      if (window.loadNotifications) {
        window.loadNotifications();
      }
    }
  );

  await PushNotifications.addListener(
    'pushNotificationActionPerformed',
    async action => {
      const data = action.notification?.data || {};

      try {
        localStorage.setItem('vicbangfit_pending_push_action', JSON.stringify(data));
      } catch (_) {}

      if (window.handleVicbangfitPushAction) {
        await window.handleVicbangfitPushAction(data);
      } else {
        window.__vicPendingPushAction = data;
      }
    }
  );

  await PushNotifications.register();
}

window.addEventListener(
  'vicbangfit-auth-ready',
  () => {
    initVicbangfitPush();
  }
);

window.addEventListener(
  'load',
  () => {
    setTimeout(() => {
      initVicbangfitPush();
    }, 1500);
  }
);
