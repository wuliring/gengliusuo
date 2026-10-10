import {sql} from "drizzle-orm";
import {integer,sqliteTable,text,index,uniqueIndex,primaryKey,check} from "drizzle-orm/sqlite-core";
export const records=sqliteTable("records",{
 id:text("id").primaryKey(),body:text("body").notNull(),name:text("name").notNull(),category:text("category").notNull(),year:integer("year"),status:text("status").notNull(),searchText:text("search_text").notNull(),revision:integer("revision").notNull().default(1),views:integer("views").notNull().default(0),createdAt:text("created_at").notNull(),updatedAt:text("updated_at").notNull(),
},t=>[index("idx_records_status_category_year").on(t.status,t.category,t.year),index("idx_records_status_updated").on(t.status,t.updatedAt)]);
export const revisions=sqliteTable("revisions",{id:integer("id").primaryKey({autoIncrement:true}),recordId:text("record_id").notNull(),version:integer("version").notNull(),body:text("body").notNull(),updatedAt:text("updated_at").notNull()},t=>[uniqueIndex("idx_revisions_record_version").on(t.recordId,t.version)]);
export const visits=sqliteTable("visits",{recordId:text("record_id").notNull(),visitor:text("visitor").notNull(),day:text("day").notNull()},t=>[uniqueIndex("idx_visits_record_visitor_day").on(t.recordId,t.visitor,t.day)]);
export const settings=sqliteTable("settings",{key:text("key").primaryKey(),value:text("value").notNull()});
export const readerRecords=sqliteTable("reader_records",{
 ownerKey:text("owner_key").notNull(),
 recordId:text("record_id").notNull().references(()=>records.id,{onDelete:"cascade"}),
 favorite:integer("favorite").notNull().default(0),favoritedAt:text("favorited_at"),
 isRead:integer("is_read").notNull().default(0),readAt:text("read_at"),
 lastVisitedAt:text("last_visited_at"),updatedAt:text("updated_at").notNull(),
},table=>[
 primaryKey({columns:[table.ownerKey,table.recordId]}),
 index("idx_reader_owner_favorite").on(table.ownerKey,table.favorite,table.favoritedAt),
 index("idx_reader_owner_read").on(table.ownerKey,table.isRead,table.readAt),
 index("idx_reader_owner_visit").on(table.ownerKey,table.lastVisitedAt),
 check("reader_favorite_boolean",sql`${table.favorite} IN (0,1)`),
 check("reader_read_boolean",sql`${table.isRead} IN (0,1)`),
]);
