const Snapshot = (() => {
  const bytes = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
  async function derive(password, salt, usage) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:600000,hash:"SHA-256"},base,{name:"AES-GCM",length:256},false,[usage]);
  }
  async function read() {
    const response=await fetch("./snapshot.enc.json",{cache:"no-store"});
    if(!response.ok) throw new Error(response.status===404?"No saved snapshot yet.":`Snapshot request failed (${response.status}).`);
    return response.json();
  }
  async function unlock(recoveryKey) {
    const snapshot=await read();
    if(snapshot.version!==1||snapshot.kdf?.iterations!==600000||snapshot.kdf?.hash!=="SHA-256"||snapshot.cipher?.name!=="AES-256-GCM") throw new Error("Unsupported snapshot format.");
    const key=await derive(recoveryKey,bytes(snapshot.kdf.salt),"decrypt");
    const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(snapshot.cipher.iv)},key,bytes(snapshot.cipher.data));
    const payload=JSON.parse(new TextDecoder().decode(plain));
    if(!payload.raw?.valueRanges||!Number.isFinite(Date.parse(payload.createdAt))) throw new Error("Invalid snapshot data.");
    return payload;
  }
  return {unlock};
})();
