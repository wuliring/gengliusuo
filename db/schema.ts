import {integer,sqliteTable,text,index,uniqueIndex} from "drizzle-orm/sqlite-core";
export const records=sqliteTable("records",{
 id:text("id").primaryKey(),body:text("body").notNull(),name:text("name").notNull(),category:text("category").notNull(),year:integer("year"),status:text("status").notNull(),searchText:text("search_text").notNull(),revision:integer("revision").notNull().default(1),views:integer("views").notNull().default(0),createdAt:text("created_at").notNull(),updatedAt:text("updated_at").notNull(),
},t=>[index("idx_records_status_category_year").on(t.status,t.category,t.year),index("idx_records_status_updated").on(t.status,t.updatedAt)]);
export const revisions=sqliteTable("revisions",{id:integer("id").primaryKey({autoIncrement:true}),recordId:text("record_id").notNull(),version:integer("version").notNull(),body:text("body").notNull(),updatedAt:text("updated_at").notNull()},t=>[uniqueIndex("idx_revisions_record_version").on(t.recordId,t.version)]);
export const visits=sqliteTable("visits",{recordId:text("record_id").notNull(),visitor:text("visitor").notNull(),day:text("day").notNull()},t=>[uniqueIndex("idx_visits_record_visitor_day").on(t.recordId,t.visitor,t.day)]);
export const settings=sqliteTable("settings",{key:text("key").primaryKey(),value:text("value").notNull()});
