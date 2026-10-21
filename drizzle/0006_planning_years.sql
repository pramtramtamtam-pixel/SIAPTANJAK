UPDATE master SET active=CASE WHEN name IN ('2027','2028','2029') THEN 1 ELSE 0 END WHERE type='tahun';
--> statement-breakpoint
INSERT INTO master (id,type,name,active) SELECT 'tahun-2027','tahun','2027',1 WHERE EXISTS(SELECT 1 FROM master) AND NOT EXISTS(SELECT 1 FROM master WHERE type='tahun' AND name='2027');
--> statement-breakpoint
INSERT INTO master (id,type,name,active) SELECT 'tahun-2028','tahun','2028',1 WHERE EXISTS(SELECT 1 FROM master) AND NOT EXISTS(SELECT 1 FROM master WHERE type='tahun' AND name='2028');
--> statement-breakpoint
INSERT INTO master (id,type,name,active) SELECT 'tahun-2029','tahun','2029',1 WHERE EXISTS(SELECT 1 FROM master) AND NOT EXISTS(SELECT 1 FROM master WHERE type='tahun' AND name='2029');
--> statement-breakpoint
DELETE FROM sessions WHERE planning_year IS NOT NULL AND planning_year NOT IN (2027,2028,2029);
