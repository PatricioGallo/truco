// La app instalada en el celular (PWA): instalación y notificaciones push.
import * as api from '@api'
import { VAPID_PUBLIC_KEY } from './config.js'

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''

/** 'ios' | 'android' | 'desktop' */
export function platform() {
  const iPadOS = /Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1
  if (/iPhone|iPad|iPod/.test(ua) || iPadOS) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

/** En iPhone, ¿es Safari? (en otros navegadores el botón Compartir está en otro lado) */
export const isIosSafari = () => platform() === 'ios' && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)

/** ¿Se está usando como app instalada (pantalla completa, desde el ícono)? */
export function isStandalone() {
  return (
    (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches) ||
    (typeof navigator !== 'undefined' && navigator.standalone === true)
  )
}

// ---------- Instalar (Android / Chrome) ----------
// El navegador avisa una sola vez que se puede instalar; guardamos ese aviso para usarlo con un botón.
let deferredPrompt = null
const listeners = new Set()
export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    listeners.forEach((cb) => cb(true))
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    listeners.forEach((cb) => cb(false))
  })
}
export const canPromptInstall = () => Boolean(deferredPrompt)
export function onInstallAvailable(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
/** Muestra el cartel de instalación del navegador. Devuelve true si la instaló. */
export async function promptInstall() {
  if (!deferredPrompt) return false
  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  return outcome === 'accepted'
}

// ---------- Notificaciones push ----------
export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** El service worker de la app (no existe en modo desarrollo). */
async function registration() {
  if (!('serviceWorker' in navigator)) return null
  return (await navigator.serviceWorker.getRegistration()) ?? null
}

function keyBytes(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** Estado de las notificaciones en este celular: 'unsupported' | 'need-install' | 'no-sw' | 'denied' | 'on' | 'off' */
export async function pushStatus() {
  if (platform() === 'ios' && !isStandalone()) return 'need-install'
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await registration()
  if (!reg) return 'no-sw'
  const sub = await reg.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

/** Activa las notificaciones en este celular. */
export async function enablePush() {
  const reg = await registration()
  if (!reg) throw new Error('Las notificaciones funcionan en la app publicada, no en la versión de prueba.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('No diste permiso para las notificaciones.')
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) })
  await api.pushSubscribe(sub.toJSON())
}

/** Las desactiva en este celular. */
export async function disablePush() {
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await api.pushUnsubscribe(sub.endpoint).catch(() => {})
  await sub.unsubscribe()
}
