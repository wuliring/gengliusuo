import {z} from "zod";
import type {StoredMeme} from "./records";

export const READER_ENTRY_LIMIT=500;
export const READER_MERGE_BATCH_LIMIT=100;
export const readerIdSchema=z.string().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,"档案地址格式不正确。");
const earliestReaderDate=Date.UTC(2000,0,1);
export const readerDateSchema=z.string().datetime({offset:true,message:"记录时间需要使用有效的 ISO 日期格式。"}).refine(value=>{
 const time=Date.parse(value);
 return Number.isFinite(time)&&time>=earliestReaderDate&&time<=Date.now()+300000;
},"记录时间需要在 2000 年至当前时间之间，请检查浏览器时间后重试。");
export const readerEntrySchema=z.object({
 id:readerIdSchema,
 favorite:z.boolean(),favoritedAt:readerDateSchema.nullable(),
 read:z.boolean(),readAt:readerDateSchema.nullable(),
 lastVisitedAt:readerDateSchema.nullable(),
}).strict();
export type ReaderEntry=z.infer<typeof readerEntrySchema>;
export type ReaderLibrary={authenticated:boolean;entries:ReaderEntry[];records:StoredMeme[]};
export const readerPatchSchema=z.object({favorite:z.boolean().optional(),read:z.boolean().optional()}).strict().refine(value=>value.favorite!==undefined||value.read!==undefined,"请指定收藏或已读状态。");
export type ReaderPatch=z.infer<typeof readerPatchSchema>;
export const readerMergeSchema=z.object({entries:z.array(readerEntrySchema).max(READER_MERGE_BATCH_LIMIT,"每次最多合并 100 条游客记录，请分批重试。")}).strict();
export type ReaderMergeResult={merged:number;skipped:number;acceptedIds:string[];library:ReaderLibrary};
export const readerEmptyBodySchema=z.object({}).strict();
