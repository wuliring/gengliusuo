import {boundedJson} from "@/lib/admin-auth";
import {readerMergeSchema} from "@/lib/reader-types";
import {requireReaderOwner,mergeReaderEntries,readerJson,readerRouteError} from "@/lib/reader-db";

export async function POST(req:Request){
 try{
  const owner=await requireReaderOwner(req);
  const input=readerMergeSchema.parse(await boundedJson(req,64000));
  return readerJson(await mergeReaderEntries(owner,input.entries));
 }catch(error){return readerRouteError(error);}
}
