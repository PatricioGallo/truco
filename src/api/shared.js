// Utilidades compartidas entre el backend real y el simulado.

export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/

export const normalizeUsername = (u) => u.trim().toLowerCase()

export function validateSignUp({ username, password, firstName, lastName }) {
  if (!USERNAME_RE.test(username))
    return 'El usuario tiene que tener entre 3 y 20 caracteres: letras, números, punto o guion bajo.'
  if (password.length < 6) return 'La contraseña tiene que tener al menos 6 caracteres.'
  if (firstName.length > 40 || lastName.length > 40) return 'Nombre y apellido: hasta 40 caracteres cada uno.'
  return null
}

export function displayName(p) {
  if (!p) return ''
  const full = [p.first_name, p.last_name].filter(Boolean).join(' ')
  return full || p.username
}

// Recorta al centro y achica la foto a 256x256 en JPEG antes de subirla.
export async function resizeImage(file, size = 256) {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  bitmap.close?.()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la foto.'))), 'image/jpeg', 0.85)
  )
}
