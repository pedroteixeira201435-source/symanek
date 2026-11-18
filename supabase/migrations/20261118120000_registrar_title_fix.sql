-- Client request (J. Fillemon, 2026-11-18): Ms. Rebbeka Shilongo's title is "Administrative Assistant".
update public.signatories set title = replace(title, 'Administration Assistant', 'Administrative Assistant') where title like '%Administration Assistant%';
update public.staff set role = 'Administrative Assistant' where role = 'Administration Assistant';
