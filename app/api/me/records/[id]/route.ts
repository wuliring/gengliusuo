import {boundedJson} from "@/lib/admin-auth";
import {readerIdSchema,readerPatchSchema} from "@/lib/reader-types";
import {requireReaderOwner,patchReaderEntry,removeReaderEntry,readReaderEmptyBody,readerJson,readerRouteError} from "@/lib/reader-db";

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const owner=await requireReaderOwner(req);
  const id=readerIdSchema.parse((await params).id);
  const patch=readerPatchSchema.parse(await boundedJson(req,1024));
  return readerJson({entry:await patchReaderEntry(owner,id,patch)});
 }catch(error){return readerRouteError(error);}
}
export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const owner=await requireReaderOwner(req);
  const id=readerIdSchema.parse((await params).id);
  await readReaderEmptyBody(req);
  await removeReaderEntry(owner,id);
  return readerJson({removed:true});
 }catch(error){return readerRouteError(error);}
}
