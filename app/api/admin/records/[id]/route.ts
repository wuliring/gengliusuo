import {z} from "zod";
import {recordSchema} from "@/lib/records";
import {getRecord,saveRecord,ArchiveError} from "@/lib/archive-db";
import {requireEditor,requireSameOrigin,boundedJson,routeError} from "@/lib/admin-auth";
export async function PUT(req:Request,{params}:{params:Promise<{id:string}>}){try{await requireEditor();requireSameOrigin(req);const{id}=await params,input=z.object({record:recordSchema,expectedRevision:z.number().int().min(1)}).safeParse(await boundedJson(req));if(!input.success)return Response.json({error:[...new Set(input.error.issues.map(v=>v.message))].join("\n")},{status:400});if(id!==input.data.record.id)throw new ArchiveError("档案地址不能在修订时更改。",400);if(!await getRecord(id,true))throw new ArchiveError("档案未找到。",404);return Response.json({record:await saveRecord(input.data.record,input.data.expectedRevision)},{headers:{"Cache-Control":"no-store"}});}catch(e){return routeError(e);}}
