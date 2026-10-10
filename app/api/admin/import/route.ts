import {z} from "zod";
import {recordSchema,formatRecordIssues,type Meme,type RecordIssue} from "@/lib/records";
import {importRecords,ArchiveError} from "@/lib/archive-db";
import {requireEditor,requireSameOrigin,boundedJson,routeError} from "@/lib/admin-auth";
export async function POST(req:Request){
 try{
  await requireEditor();requireSameOrigin(req);
  const raw=await boundedJson(req,5000000),envelope=z.object({format:z.literal("gengliusuo-archive"),formatVersion:z.literal(1),records:z.array(z.unknown()).min(1).max(100)}).safeParse(raw);
  if(!envelope.success)throw new ArchiveError("请选择梗留所导出的 JSON 备份。每批最多 100 份档案、5MB；备份页面会自动分批处理。",400);
  const records:Meme[]=[],issues:RecordIssue[]=[],ids=new Set<string>();
  for(const [index,value]of envelope.data.records.entries()){
   if(!value||typeof value!=="object"||Array.isArray(value)){issues.push({path:["records",index],message:`第 ${index+1} 份档案：内容格式不正确。`});continue;}
   const parsed=recordSchema.safeParse({...value,status:"draft"});
   if(!parsed.success){issues.push(...formatRecordIssues(parsed.error.issues.map(issue=>({...issue,path:["records",index,...issue.path]}))));continue;}
   if(ids.has(parsed.data.id)){issues.push({path:["records",index,"id"],message:`第 ${index+1} 份档案：地址 ${parsed.data.id} 在本批次重复。`});continue;}
   ids.add(parsed.data.id);records.push(parsed.data);
  }
  if(issues.length)return Response.json({error:issues.slice(0,20).map(v=>v.message).join("\n"),issues:issues.slice(0,50)},{status:400,headers:{"Cache-Control":"no-store"}});
  return Response.json(await importRecords(records),{headers:{"Cache-Control":"no-store"}});
 }catch(error){return routeError(error);}
}
