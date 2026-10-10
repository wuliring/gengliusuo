export type RequestIssue = {path:(string|number)[];message:string};
export class RequestError extends Error {
 constructor(message:string,public readonly status:number,public readonly issues?:RequestIssue[]){super(message);this.name="RequestError";}
}
export async function requestJson<T>(url:string,init:RequestInit={}):Promise<T>{
 const controller=new AbortController();let timedOut=false;
 const cancel=()=>controller.abort();
 if(init.signal?.aborted)throw new DOMException("请求已取消","AbortError");
 init.signal?.addEventListener("abort",cancel,{once:true});
 const timeout=setTimeout(()=>{timedOut=true;controller.abort();},30000);
 try{
  const response=await fetch(url,{credentials:"same-origin",cache:"no-store",...init,signal:controller.signal});
  const text=await response.text();let value:unknown;
  try{value=JSON.parse(text);}catch{throw new RequestError(response.status===401||response.status===403?"登录状态已失效或没有操作权限，请重新登录后重试。":"服务器没有返回可读取的结果，请稍后重试。",response.status);}
  if(!response.ok){const data=value&&typeof value==="object"?value as Record<string,unknown>:{};const issues=Array.isArray(data.issues)?data.issues.filter((item):item is RequestIssue=>!!item&&typeof item==="object"&&Array.isArray(item.path)&&typeof item.message==="string"):undefined;throw new RequestError(typeof data.error==="string"?data.error:"暂时无法完成，请稍后重试。",response.status,issues);}
  return value as T;
 }catch(error){
  if(error instanceof RequestError)throw error;
  if(init.signal?.aborted)throw new DOMException("请求已取消","AbortError");
  if(timedOut)throw new RequestError("网络响应超时，请稍后重试；已保存的数据仍会保留。",0);
  throw new RequestError("网络连接未完成，请检查连接后重试。",0);
 }finally{clearTimeout(timeout);init.signal?.removeEventListener("abort",cancel);}
}
