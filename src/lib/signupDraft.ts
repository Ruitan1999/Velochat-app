let signupAvatarLocalUri: string | null = null

export function setSignupAvatarLocalUri(uri: string | null) {
  signupAvatarLocalUri = uri
}

export function getSignupAvatarLocalUri() {
  return signupAvatarLocalUri
}

export function clearSignupDraft() {
  signupAvatarLocalUri = null
}

