-- Run after central-pricing-schema.sql.
-- No prices are seeded: the administrator must publish actual purchase prices.
insert into public.qualidades_metal(metal,nome,toque,ativo) values
('ouro','24k',999,true),
('ouro','23k',958,false),
('ouro','22k',916,false),
('ouro','21k',875,false),
('ouro','20k',833,false),
('ouro','19,2k',800,true),
('ouro','19k',792,false),
('ouro','18k',750,true),
('ouro','17k',708,false),
('ouro','16k',667,false),
('ouro','15k',625,false),
('ouro','14k',585,true),
('ouro','12k',500,false),
('ouro','10k',417,false),
('ouro','9k',375,true),
('ouro','8k',333,false),
('prata','Prata 925',925,false)
on conflict(metal,toque) do nothing;
-- Legacy 19k/800 labels must be explicitly reconciled, never silently mapped.
-- Inactive grades are available for future activation by administration.
