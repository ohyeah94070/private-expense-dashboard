const Snapshot = (() => {
  const repo = "ohyeah94070/private-expense-dashboard";
  const path = "investment/snapshot.enc.json";
  const api = `https://api.github.com/repos/${repo}/contents/${path}`;
  const b64 = bytes => { let binary=""; for(let i=0;i<bytes.length;i+=8192) binary+=String.fromCharCode(...bytes.subarray(i,i+8192)); return btoa(binary); };
  const bytes = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
  const encode = text => b64(new TextEncoder().encode(text));
  async function derive(password, salt, usage) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:600000,hash:"SHA-256"},base,{name:"AES-GCM",length:256},false,[usage]);
  }
  async function encrypt(raw, recoveryKey) {
    const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
    const key=await derive(recoveryKey,salt,"encrypt");
    const createdAt=new Date().toISOString();
    const payload=new TextEncoder().encode(JSON.stringify({raw,createdAt}));
    const data=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,payload));
    return {version:1,kdf:{name:"PBKDF2",hash:"SHA-256",iterations:600000,salt:b64(salt)},cipher:{name:"AES-256-GCM",iv:b64(iv),data:b64(data)}};
  }
  async function read() {
    const response=await fetch(api,{headers:{Accept:"application/vnd.github.raw+json"},cache:"no-store"});
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
  async function publish(raw,recoveryKey,githubToken) {
    if(recoveryKey.length<20) throw new Error("Use a recovery key of at least 20 characters.");
    if(!githubToken) throw new Error("Enter a repository write token.");
    const snapshot=await encrypt(raw,recoveryKey);
    const headers={Authorization:`Bearer ${githubToken}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};
    const current=await fetch(api,{headers,cache:"no-store"});
    if(!current.ok&&current.status!==404) throw new Error(`GitHub access failed (${current.status}).`);
    const sha=current.ok?(await current.json()).sha:undefined;
    const content=encode(JSON.stringify(snapshot)+"\n");
    const response=await fetch(api,{method:"PUT",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({message:"Update encrypted investment snapshot",content,...(sha?{sha}:{})})});
    if(!response.ok) throw new Error(`GitHub snapshot update failed (${response.status}).`);
    return new Date().toISOString();
  }
  return {unlock,publish};
})();
