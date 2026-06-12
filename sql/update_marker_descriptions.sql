-- Update map marker descriptions from Azgaar .map file
-- Only fills in rows where description is currently NULL or empty

-- SETTLEMENTS

UPDATE map_markers SET description = 'Population: ~6,213
Features: capital, citadel, walls, plaza' WHERE name = 'Altash' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~6,096
Type: Naval
Features: capital, port, citadel, walls' WHERE name = 'Newbrag' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~28,323
Features: capital, citadel, walls, plaza' WHERE name = 'Cleobury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~5,600
Type: Naval
Features: capital, port, citadel, walls, plaza' WHERE name = 'Redcke' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~35,064
Features: capital, citadel, walls, temple, plaza, shanty town' WHERE name = 'Birwick' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~14,180
Features: capital, citadel, walls' WHERE name = 'Cliford' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~9,948
Type: Naval
Features: capital, port, citadel, walls, plaza' WHERE name = 'Wicksey' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~7,471' WHERE name = 'Solescom' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~27,595
Type: Naval
Features: port, citadel, walls' WHERE name = 'Retbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~7,871
Features: citadel' WHERE name = 'Fihul' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~9,921
Features: citadel, walls' WHERE name = 'Saleton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,159
Type: Hunting
Features: citadel' WHERE name = 'Berlisham' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~16,298
Features: walls' WHERE name = 'Lurymocksey' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~10,341
Type: Naval
Features: port, walls' WHERE name = 'Portsmouth' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~18,727
Type: Lake
Features: walls, plaza' WHERE name = 'Orneton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,658
Type: Hunting
Features: citadel' WHERE name = 'Quatbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~10,939
Features: plaza' WHERE name = 'Winewentham' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~16,759
Features: plaza' WHERE name = 'Hendoneton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~11,795
Features: citadel, walls, plaza' WHERE name = 'Malcester' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~10,076
Type: Naval
Features: port, citadel, walls, plaza' WHERE name = 'Redckerbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,721
Type: Hunting
Features: citadel, plaza' WHERE name = 'Congton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~22,057
Features: citadel, walls, temple, shanty town' WHERE name = 'Westham' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~8,747
Features: citadel, walls' WHERE name = 'Hathorough' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~3,255
Type: Naval
Features: port, citadel' WHERE name = 'Draxtedley' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~4,274
Type: Lake
Features: citadel, walls' WHERE name = 'Atford' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,795
Type: Hunting' WHERE name = 'Chawbigton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~13,917
Features: citadel, walls' WHERE name = 'Hertes' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~24,414
Type: Naval
Features: port, walls, plaza' WHERE name = 'Albrid' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,930
Type: Hunting
Features: citadel' WHERE name = 'Prescastle' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~8,323' WHERE name = 'Albrole' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~11,982
Features: citadel, walls, plaza' WHERE name = 'Redclescom' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~9,365
Features: plaza' WHERE name = 'Baltashet' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~7,062
Type: Naval
Features: port' WHERE name = 'Boston' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~6,115
Features: citadel' WHERE name = 'Nosterton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,369
Type: Hunting
Features: citadel' WHERE name = 'Burwicksey' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~24,676
Type: Naval
Features: port, citadel, walls, shanty town' WHERE name = 'Louthestow' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,594
Type: Hunting' WHERE name = 'Hornmouth' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,587
Type: Hunting' WHERE name = 'Presmouth' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,595
Type: Hunting
Features: citadel, walls' WHERE name = 'Maldon' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~11,747
Type: Naval
Features: port, citadel, walls, plaza' WHERE name = 'Skipingin' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~5,268
Type: Hunting' WHERE name = 'Presham' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~3,337
Type: Hunting' WHERE name = 'Hitchetford' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~18,593
Type: Naval
Features: port, walls, plaza' WHERE name = 'Macham' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~8,411
Type: Naval
Features: port, citadel' WHERE name = 'Casthesore' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,568
Type: Hunting' WHERE name = 'Oakleigh' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~6,007
Features: citadel' WHERE name = 'Bothone' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~10,833
Features: walls, plaza' WHERE name = 'Newleighton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,631
Type: Naval
Features: port' WHERE name = 'Quatford' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,999
Type: Hunting
Features: walls' WHERE name = 'Presterby' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~19,876
Type: Naval
Features: port, citadel' WHERE name = 'Towleigh' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,775
Type: Hunting
Features: citadel, plaza' WHERE name = 'Alewichet' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,022
Type: Hunting
Features: citadel' WHERE name = 'Maldockley' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~20,957
Features: walls, temple, shanty town' WHERE name = 'Aymouthing' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~8,637
Features: citadel' WHERE name = 'Pilmondling' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~22,449
Type: Naval
Features: port, citadel, walls, plaza, shanty town' WHERE name = 'Wacury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,017
Type: Hunting
Features: citadel, walls, plaza' WHERE name = 'Apledine' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,733
Type: Hunting' WHERE name = 'Warton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~3,123
Type: Hunting' WHERE name = 'Atford' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,586
Type: Naval
Features: port' WHERE name = 'Balterham' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~44,043
Features: citadel, walls, plaza, shanty town' WHERE name = 'Bunter' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~10,193
Features: citadel, plaza' WHERE name = 'Mackingmo' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~3,100
Type: Hunting
Features: walls' WHERE name = 'Clitletown' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,359
Type: Hunting
Features: walls' WHERE name = 'Bateslewen' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~6,270
Features: citadel, plaza' WHERE name = 'Granton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~8,992
Features: citadel' WHERE name = 'Southbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,103
Type: Lake
Features: plaza' WHERE name = 'Boltash' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~13,325
Features: walls' WHERE name = 'Sherster' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~3,486
Type: Hunting
Features: plaza' WHERE name = 'Watbutondo' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~15,647
Features: citadel, plaza' WHERE name = 'Brasterton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~10,513
Features: citadel, walls, plaza' WHERE name = 'Rothwelme' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~3,126
Type: Hunting
Features: plaza' WHERE name = 'Causinta' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,744
Type: Hunting' WHERE name = 'Knabingin' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~5,561
Type: Hunting
Features: plaza' WHERE name = 'Shorough' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~12,889
Features: citadel, walls' WHERE name = 'Albletondo' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,937
Type: Hunting
Features: walls' WHERE name = 'Tarfordmin' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~10,647
Features: citadel, plaza' WHERE name = 'Skiple' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~9,798' WHERE name = 'Dodbrid' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~12,114' WHERE name = 'Matestoney' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~12,586
Type: Highland
Features: walls, plaza' WHERE name = 'Northam' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~8,877
Features: citadel, plaza' WHERE name = 'Bodbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~9,828' WHERE name = 'Boliver' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~6,112
Features: walls' WHERE name = 'Tarley' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~12,907
Features: walls, plaza' WHERE name = 'Daltonzan' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,218
Type: Hunting
Features: walls' WHERE name = 'Abingtonton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~7,481' WHERE name = 'Rearale' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~7,340
Features: citadel, plaza' WHERE name = 'Etonzan' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~17,301
Features: citadel, walls' WHERE name = 'Warley' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~17,061
Features: citadel, plaza' WHERE name = 'Brasbutondo' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~22,671
Type: Naval
Features: port, walls, temple, plaza, shanty town' WHERE name = 'Clifractho' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~12,318
Features: citadel, walls, plaza' WHERE name = 'Horndoke' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~13,728
Features: citadel, walls' WHERE name = 'Peneymock' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~21,093
Features: walls, plaza' WHERE name = 'Cocking' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~17,172
Features: walls, plaza' WHERE name = 'Grantbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~4,448
Type: Hunting' WHERE name = 'Forough' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~8,779
Features: plaza' WHERE name = 'Bivewent' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~14,984
Features: walls, plaza' WHERE name = 'Ormscom' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~8,768
Features: citadel' WHERE name = 'Soutbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,606
Type: Hunting
Features: citadel' WHERE name = 'Alborbot' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,681
Type: Hunting
Features: citadel' WHERE name = 'Newbigin' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~6,268
Features: citadel' WHERE name = 'Grantford' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,546
Type: Hunting
Features: citadel' WHERE name = 'Clifton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~10,804
Features: citadel, plaza' WHERE name = 'Burbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~8,393
Features: walls' WHERE name = 'Norlingham' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~10,006' WHERE name = 'Beryme' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,617
Type: Hunting
Features: citadel' WHERE name = 'Camblemade' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~18,784
Features: plaza' WHERE name = 'Gatbuton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,113
Type: Hunting
Features: plaza' WHERE name = 'Luryteston' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~4,103
Type: Hunting
Features: walls' WHERE name = 'Exning' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,888
Features: citadel, walls' WHERE name = 'Atesleley' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,681
Type: Hunting
Features: plaza' WHERE name = 'Dymockwar' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~9,161' WHERE name = 'Solineton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~9,132' WHERE name = 'Presmouth' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,784
Type: Hunting' WHERE name = 'Compound' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~12,641
Features: plaza' WHERE name = 'Preston' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~4,342
Type: Hunting' WHERE name = 'Sudmouthin' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,769
Type: Naval
Features: port, citadel' WHERE name = 'Withole' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~5,400
Type: Naval
Features: port' WHERE name = 'Padsbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,208
Type: Hunting
Features: plaza' WHERE name = 'Ormstoney' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~21,280
Features: citadel, walls, plaza' WHERE name = 'Oltoningt' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,014
Type: Hunting' WHERE name = 'Wickneth' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,853
Type: Naval
Features: port, citadel, walls' WHERE name = 'Baldock' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~5,606
Type: Hunting
Features: citadel' WHERE name = 'Clifnal' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,944
Type: Hunting
Features: citadel, plaza' WHERE name = 'Kihulsea' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~11,212
Type: Naval
Features: port, citadel, walls, plaza' WHERE name = 'Newborough' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~9,114
Features: plaza' WHERE name = 'Tresorough' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~17,936
Features: citadel, walls, plaza' WHERE name = 'Witfordle' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~13,144
Features: citadel, plaza' WHERE name = 'Helstabrigh' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~3,838
Type: Hunting' WHERE name = 'Sherscombe' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,636
Type: Hunting' WHERE name = 'Rockerne' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,916
Type: Hunting
Features: citadel' WHERE name = 'Kilkham' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~11,095
Features: citadel, plaza' WHERE name = 'Nostabro' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~7,483' WHERE name = 'Netondal' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~6,264
Features: citadel' WHERE name = 'Chipton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,553
Type: Hunting
Features: citadel' WHERE name = 'Cleobury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,276
Features: citadel' WHERE name = 'Berford' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~13,021
Features: walls' WHERE name = 'Mitherden' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~15,587
Features: citadel, walls, plaza' WHERE name = 'Winkburgh' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~10,024' WHERE name = 'Skiple' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~15,295
Features: plaza' WHERE name = 'Weningthe' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~5,394
Type: Hunting' WHERE name = 'Ormsham' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,355
Type: Hunting
Features: plaza' WHERE name = 'Antonley' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~5,623
Type: Hunting' WHERE name = 'Skipington' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~15,468
Features: walls, plaza' WHERE name = 'Moden' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,667
Type: Hunting
Features: citadel' WHERE name = 'Midgesey' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~13,401
Features: citadel, walls, plaza' WHERE name = 'Maldondal' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,887
Type: Hunting' WHERE name = 'Hinckneth' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~31,631
Type: Naval
Features: port, citadel, walls, temple, plaza' WHERE name = 'Cleomyard' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~8,218
Type: Naval
Features: port, citadel, walls' WHERE name = 'Yeorough' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~8,855
Features: plaza' WHERE name = 'Cudgedon' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~31,471
Type: Naval
Features: port, walls, plaza' WHERE name = 'Thatclester' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,827
Type: Hunting
Features: citadel, walls' WHERE name = 'Whitlexeton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~12,118' WHERE name = 'Wishead' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,057
Type: Hunting
Features: citadel' WHERE name = 'Portsho' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~15,952
Type: Lake
Features: walls' WHERE name = 'Lympston' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,612
Type: Hunting
Features: citadel' WHERE name = 'Ormsfieldbu' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,038
Type: Hunting
Features: citadel' WHERE name = 'Barton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~15,762
Features: plaza' WHERE name = 'Merhamney' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~5,884
Type: Hunting' WHERE name = 'Wigtonor' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~961
Type: Hunting
Features: citadel' WHERE name = 'Piclif' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~12,937
Type: Naval
Features: port, citadel' WHERE name = 'Bolton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~9,052' WHERE name = 'Burleigh' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~9,415
Features: citadel' WHERE name = 'Warwick' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,804
Type: Hunting
Features: citadel' WHERE name = 'Dunsbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~18,672
Features: citadel, walls, plaza' WHERE name = 'Wisbuton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,088
Type: Hunting
Features: citadel' WHERE name = 'Macham' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~11,503
Features: walls' WHERE name = 'Carlingley' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,086
Type: Lake
Features: citadel' WHERE name = 'Yeorough' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,865
Type: Hunting
Features: citadel, plaza' WHERE name = 'Crafthers' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~14,287
Type: Naval
Features: port, walls' WHERE name = 'Padsterpor' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~20,975
Features: walls, plaza, shanty town' WHERE name = 'Kirfordling' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,792
Type: Naval
Features: port, walls, plaza' WHERE name = 'Bostontef' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~20,232
Type: Naval
Features: port, walls, temple, plaza' WHERE name = 'Tutleter' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~3,407
Type: Naval
Features: port, citadel, plaza' WHERE name = 'Shersfield' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~8,817' WHERE name = 'Witford' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~9,767
Features: plaza' WHERE name = 'Calneydon' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~10,567
Features: walls, plaza' WHERE name = 'Shorough' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,300
Type: Hunting
Features: citadel' WHERE name = 'Dodbrigh' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~3,851
Type: Hunting
Features: citadel, plaza' WHERE name = 'Shersterke' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~4,311
Type: Hunting
Features: plaza' WHERE name = 'Clifton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,728
Type: Hunting
Features: plaza' WHERE name = 'Maclif' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~10,975
Type: Naval
Features: port, citadel, walls, plaza' WHERE name = 'Mitre' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~24,666
Type: Lake
Features: citadel, walls, plaza' WHERE name = 'Burton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~4,239
Type: Hunting
Features: citadel' WHERE name = 'Stotre' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,939
Type: Naval
Features: port, citadel' WHERE name = 'Craftford' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~12,655
Type: Naval
Features: port, citadel' WHERE name = 'Apleford' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,845
Type: Hunting
Features: citadel, walls, plaza' WHERE name = 'Whithers' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~6,120
Features: plaza' WHERE name = 'Wargrading' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~37,704
Features: walls, temple, plaza' WHERE name = 'Watham' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~9,748
Features: citadel' WHERE name = 'Cliford' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,228
Type: Hunting' WHERE name = 'Guildlingmo' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~13,874
Type: Naval
Features: port, citadel, walls, plaza' WHERE name = 'Malseading' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,690
Type: Hunting
Features: plaza' WHERE name = 'Chisbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~13,427
Features: citadel, plaza' WHERE name = 'Draxted' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,107
Type: Hunting' WHERE name = 'Boneton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,769
Type: Hunting
Features: citadel' WHERE name = 'Corewester' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~7,949' WHERE name = 'Chiswest' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,732
Type: Hunting
Features: plaza' WHERE name = 'Apton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,592
Type: Hunting' WHERE name = 'Thaxning' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,526
Type: Hunting
Features: walls' WHERE name = 'Picker' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~16,835
Type: Lake
Features: citadel, walls, plaza' WHERE name = 'Hatfordley' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~7,142
Features: citadel' WHERE name = 'Chawleigh' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~9,194
Type: Lake
Features: walls' WHERE name = 'Bingley' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~6,418
Features: citadel' WHERE name = 'Ostabrigh' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~16,261
Type: Naval
Features: port' WHERE name = 'Lympston' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~15,618
Features: plaza' WHERE name = 'Nosterwick' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~11,839
Features: citadel, walls' WHERE name = 'Axbrid' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,831
Type: Hunting
Features: walls' WHERE name = 'Wathorough' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~7,598
Features: citadel, plaza' WHERE name = 'Padsbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,414
Type: Hunting
Features: citadel, walls, plaza' WHERE name = 'Perscom' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,088
Type: Hunting
Features: plaza' WHERE name = 'Retbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~725
Features: citadel, walls' WHERE name = 'Aldockley' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~4,142
Type: Hunting
Features: plaza' WHERE name = 'Boling' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,777
Type: Hunting
Features: plaza' WHERE name = 'Linley' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~697
Features: citadel' WHERE name = 'Framping' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~9,247
Features: citadel' WHERE name = 'Daldock' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~7,519' WHERE name = 'Whitfieldbu' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~7,969
Features: plaza' WHERE name = 'Cambridbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~8,250' WHERE name = 'Cambridge' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,124
Type: Hunting
Features: walls' WHERE name = 'Darwick' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~3,890
Type: Hunting
Features: walls' WHERE name = 'Tinerereby' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~9,455
Type: Lake' WHERE name = 'Barton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~8,160' WHERE name = 'Madingin' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~9,620
Features: plaza' WHERE name = 'Holboverton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~6,705
Features: citadel, walls' WHERE name = 'Hatford' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,696
Type: Hunting' WHERE name = 'Cambridmin' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~7,665
Features: plaza' WHERE name = 'Saldock' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~4,513
Type: Hunting' WHERE name = 'Holing' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~976
Type: Hunting
Features: citadel' WHERE name = 'Hatbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~4,004
Features: walls' WHERE name = 'Stapton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~653' WHERE name = 'Charnehole' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,763
Type: Hunting
Features: citadel, walls' WHERE name = 'Childock' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,723
Type: Hunting' WHERE name = 'Rothetbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,253
Type: Naval
Features: port, citadel, walls' WHERE name = 'Thatclesto' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~12,646
Type: Lake
Features: walls, plaza' WHERE name = 'Cleowey' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~6,211
Features: citadel' WHERE name = 'Towleigh' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,865
Type: Hunting
Features: citadel' WHERE name = 'Hatfordge' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~8,920
Features: citadel, walls, plaza' WHERE name = 'Winkham' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~957
Features: plaza' WHERE name = 'Wargham' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~10,753
Features: plaza' WHERE name = 'Launterton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~9,688' WHERE name = 'Harford' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,357
Type: Hunting
Features: walls, plaza' WHERE name = 'Tihulton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~8,646
Features: citadel' WHERE name = 'Dunstolelis' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,750' WHERE name = 'Withamburgh' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~11,553
Type: Naval
Features: port, walls' WHERE name = 'Axbrigh' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~8,633' WHERE name = 'Dunstorough' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~5,630
Features: citadel, plaza' WHERE name = 'Presfield' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,688
Type: Hunting' WHERE name = 'Westfordge' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,736
Type: Hunting
Features: citadel, walls, plaza' WHERE name = 'Altondoke' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,097
Type: Lake
Features: citadel, plaza' WHERE name = 'Maclescom' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~20,269
Features: walls, temple, plaza' WHERE name = 'Herthe' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~8,241' WHERE name = 'Felton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~12,960
Features: plaza' WHERE name = 'Bingdon' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~7,721
Features: citadel, walls' WHERE name = 'Watherton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,724
Type: Hunting
Features: citadel, walls' WHERE name = 'Noscom' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,598
Type: Hunting
Features: citadel' WHERE name = 'Kirden' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~646
Features: plaza' WHERE name = 'Grantleter' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,943
Type: Hunting
Features: citadel, walls, plaza' WHERE name = 'Holterming' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~649
Features: plaza' WHERE name = 'Chipton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~3,835
Type: Naval
Features: port, citadel, plaza' WHERE name = 'Shersted' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~9,048
Features: citadel, walls' WHERE name = 'Preshambe' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,916
Type: Hunting' WHERE name = 'Congton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~5,607
Features: citadel' WHERE name = 'Whithe' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~11,936
Features: citadel, plaza' WHERE name = 'Tarbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~8,691
Features: citadel' WHERE name = 'Harington' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~5,954
Type: Hunting
Features: citadel, walls, plaza' WHERE name = 'Towcestery' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,131
Type: Hunting
Features: citadel, plaza' WHERE name = 'Hinckwarton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~21,669
Features: citadel, walls, plaza, shanty town' WHERE name = 'Axbridge' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,952
Type: Hunting
Features: walls, plaza' WHERE name = 'Yeorough' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,577
Type: Hunting
Features: citadel' WHERE name = 'Boldon' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~10,471
Features: plaza' WHERE name = 'Birdenton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,662
Features: citadel' WHERE name = 'Penkham' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,348
Type: Hunting
Features: plaza' WHERE name = 'Marshester' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,050
Type: Hunting' WHERE name = 'Wishamney' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~12,626
Features: walls' WHERE name = 'Horsbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,107
Type: Hunting
Features: plaza' WHERE name = 'Launterford' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~6,594' WHERE name = 'Godbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~4,296
Features: plaza' WHERE name = 'Oakhampton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,157
Type: Lake' WHERE name = 'Bodbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~665' WHERE name = 'Brolideton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,606
Type: Hunting
Features: plaza' WHERE name = 'Wodling' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,084
Type: Hunting
Features: citadel, plaza' WHERE name = 'Thatcheap' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~695
Features: plaza' WHERE name = 'Westcheap' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~3,822
Features: citadel' WHERE name = 'Sidgeroere' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~7,912' WHERE name = 'Apton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~9,231
Type: Naval
Features: port, plaza' WHERE name = 'Atfordleby' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~6,717
Type: Lake' WHERE name = 'Lympsted' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~14,915
Features: walls, plaza' WHERE name = 'Dunswest' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,723
Type: Hunting
Features: citadel' WHERE name = 'Dunshorough' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~13,834
Features: citadel, walls, plaza' WHERE name = 'Whitford' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~6,401
Features: citadel' WHERE name = 'Ashwelbore' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~932
Features: citadel, plaza' WHERE name = 'Hinckhambe' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~6,188
Features: citadel' WHERE name = 'Machamber' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~7,226
Features: citadel' WHERE name = 'Normouthes' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~6,576' WHERE name = 'Whitford' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~598
Features: citadel' WHERE name = 'Dudbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~12,187
Type: Lake
Features: citadel' WHERE name = 'Oltery' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,908
Type: Lake
Features: citadel' WHERE name = 'Chistorough' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~15,110
Type: Naval
Features: port, walls, plaza' WHERE name = 'Searare' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~3,234
Features: citadel, plaza' WHERE name = 'Pickingin' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~825' WHERE name = 'Warton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~6,926
Features: citadel' WHERE name = 'Thaxtedbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~8,207
Features: citadel' WHERE name = 'Framping' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~3,498
Type: Highland
Features: citadel' WHERE name = 'Marshwel' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,290' WHERE name = 'Bridge' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~15,367
Features: citadel, plaza' WHERE name = 'Paigntabing' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,010
Type: Hunting
Features: citadel, walls' WHERE name = 'Dodbridge' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~643
Features: citadel' WHERE name = 'Berming' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~5,904
Type: Hunting
Features: citadel' WHERE name = 'Warton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,535
Type: Hunting
Features: citadel, walls, plaza' WHERE name = 'Cartondon' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~691' WHERE name = 'Olmebymock' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~3,209
Type: Hunting' WHERE name = 'Macker' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,122
Type: Lake' WHERE name = 'Oakhampton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~4,010' WHERE name = 'Dodbrighes' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~3,754
Features: citadel, plaza' WHERE name = 'Treley' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~3,375
Type: Hunting' WHERE name = 'Watchwark' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,160
Type: Hunting
Features: citadel' WHERE name = 'Herton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,101
Type: Hunting
Features: walls' WHERE name = 'Albrid' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,008
Type: Hunting
Features: citadel' WHERE name = 'Bostowbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~22,004
Features: temple, plaza' WHERE name = 'Mabington' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~783
Features: citadel' WHERE name = 'Shifnal' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~680
Features: citadel, plaza' WHERE name = 'Chiplere' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~3,983' WHERE name = 'Mabingley' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,177
Type: Hunting
Features: citadel' WHERE name = 'Knamers' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~684
Features: citadel, plaza' WHERE name = 'Dunston' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,711
Type: Hunting
Features: walls' WHERE name = 'Tetham' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~18,617
Features: citadel, walls, plaza' WHERE name = 'Draxted' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~6,672
Features: citadel' WHERE name = 'Rethampound' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~5,356' WHERE name = 'Stanwichton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,870
Features: plaza' WHERE name = 'Athambe' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~690' WHERE name = 'Wavesey' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~5,191
Type: Hunting
Features: walls' WHERE name = 'Cambridbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,360
Features: citadel' WHERE name = 'Uxbrighwel' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~670
Features: citadel' WHERE name = 'Nosfieldge' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,003
Features: citadel' WHERE name = 'Mitleven' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,428
Type: Hunting' WHERE name = 'Horsterley' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~10,595
Features: citadel, plaza' WHERE name = 'Carton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~3,286
Features: citadel' WHERE name = 'Craftfordge' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~749
Features: citadel' WHERE name = 'Childockley' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,192' WHERE name = 'Boston' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~748
Features: walls' WHERE name = 'Thaxningley' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,970
Type: Hunting
Features: citadel, plaza' WHERE name = 'Bether' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,789
Type: Hunting
Features: citadel' WHERE name = 'Sorough' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~12,471
Features: citadel, walls, plaza' WHERE name = 'Stotbume' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~721
Features: citadel' WHERE name = 'Westfordmin' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~10,088
Features: citadel, plaza' WHERE name = 'Horster' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,937
Type: Hunting
Features: citadel' WHERE name = 'Binetonor' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,865
Features: plaza' WHERE name = 'Mantefract' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~3,596
Type: Hunting
Features: citadel, plaza' WHERE name = 'Brastonta' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,561
Type: Hunting
Features: citadel, plaza' WHERE name = 'Penkham' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~636
Features: plaza' WHERE name = 'Caltonceso' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,836
Features: citadel' WHERE name = 'Congton' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~2,399' WHERE name = 'Harbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~4,825
Features: citadel, plaza' WHERE name = 'Stansbury' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~1,123
Type: Hunting' WHERE name = 'Thetford' AND type IN ('city','town') AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Population: ~4,192
Features: citadel' WHERE name = 'Betesfield' AND type IN ('city','town') AND (description IS NULL OR description = '');

-- EXTRA MARKERS

UPDATE map_markers SET description = 'Dormant volcano. Height: 9216 ft.' WHERE name = 'Sidmanch Volcano' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'A geothermal springs with naturally heated water that provide relaxation and medicinal benefits. Average temperature is 104°F.' WHERE name = 'Montemiterva' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'This legendary water source is whispered about in ancient tales and believed to possess mystical properties. The spring emanates crystal-clear water, shimmering with an otherworldly iridescence that sparkles even in the dimmest light.' WHERE name = 'Rocca Creek of Luck' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Collano is a mining town of 670 people just nearby the iron mine.' WHERE name = 'Collano — iron mining town' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'A lengthy bridge spans over the Anilia River near Patroniale.' WHERE name = 'Patroniale Bridge' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'A rickety bridge spans over the Feteviglio River near Anovolinoli.' WHERE name = 'Anovolinoli Bridge' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'A big and famous roadside tavern. Delicious dried spinach with smelly cider is served here.' WHERE name = 'The Divine Tavern' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'A big and famous roadside tavern. Delicious dry-aged onions with bitter wine is served here.' WHERE name = 'The Bright Buffalo' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'A lighthouse to serve as a beacon for ships in the open sea.' WHERE name = 'Rigian Lighthouse' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'A historical battle of the Nespotenian War. Date: August 11, 678 Haltash Era.' WHERE name = 'Guildgeton Battlefield' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'A historical battle of the Antaranian Conquest. Date: January 13, 714 Haltash Era.' WHERE name = 'Citrico Battlefield' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'A historical battle of the Nespotenian War. Date: September 5, 685 Haltash Era.' WHERE name = 'Altford Battlefield' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Legends say a relic monster of 16 ft long inhabits Monteta Lake. Truth or lie, folks are afraid to fish in the lake.' WHERE name = 'Monteta Monster' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Old sailors tell stories of a gigantic sea monster inhabiting these dangerous waters. Rumors say it can be 25 ft long.' WHERE name = 'Arester Monster' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Journeying folk speak of a terrifying Warg who inhabits Pontitellet hills and harasses travelers in the area.' WHERE name = 'Pontitellet Warg' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'A forest sacred to local Tallian Spirits.' WHERE name = 'Collegiomeri Forest' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'A pinery sacred to local Tallian Spirits.' WHERE name = 'Sezali Pinery' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'A palm grove sacred to local Tallian Spirits.' WHERE name = 'Vinonianone Palm Grove' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'A gang of forest brigands.' WHERE name = 'Scando Spiders' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'A gang of forest bandits.' WHERE name = 'Gorro Beavers' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Pirate ships have been spotted in these waters.' WHERE name = 'Pirates' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Pirate ships have been spotted in these waters.' WHERE name = 'Pirates' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'An ancient statue. It has an inscription, but no one can translate it: ⳐⳞ ⳆⳃⲸⳂⳄⲼⳂⲺ ⲴⳬⳄ⳾⳹ⳘⳘⳜⲲ Ⳡ Ⳡ⳥ⲾⲶⳌⳭⳈⳞⳔ ⳆⳆⳬ ⳂⳠ ⳜⳚⳞ⳥⳾ⳄⳫⳌⲾⳫⳔⳠⳘⳄ ⳁ⳧' WHERE name = 'Bramburgh Statue' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'An ancient runestone. It has an inscription, but no one can translate it: 𐠘𐠃𐠑𐠜𐠲𐠃𐠐𐠢𐠫𐠂𐠤 𐠧𐠵𐠩𐠴𐠗𐠬 𐠛𐠰𐠡' WHERE name = 'Montigliase Runestone' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'An ancient idol. It has an inscription, but no one can translate it: 𐠯𐠳𐠋𐠎𐠝 𐠿𐠟𐠔𐠒 𐠒𐠝 𐠛𐠝 ' WHERE name = 'Scandrigna Idol' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Ruins of an ancient outpost. Untold riches may lie within.' WHERE name = 'Ruined Outpost' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Ruins of an ancient castle. Untold riches may lie within.' WHERE name = 'Ruined Castle' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Ruins of an ancient outpost. Untold riches may lie within.' WHERE name = 'Ruined Outpost' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'A vast collection of knowledge, including many rare and ancient tomes.' WHERE name = 'Belleno Collection' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Roll up, roll up, this breathtaking circus is here for a limited time only.' WHERE name = 'Travelling Breathtaking Circus' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Warriors from around the land gather for a joust of the greats in Conti, with fame, fortune and favour on offer to the victor.' WHERE name = 'Conti Joust' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'A fair is being held in Camba, with all manner of local and foreign goods and services on offer.' WHERE name = 'Camba Fair' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'A small location along the Casco River to launch boats from sits here, along with a weary looking owner, willing to sell passage along the river.' WHERE name = 'Minor Jetty' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'A huge group of scorpions are migrating, whether part of their annual routine, or something more extraordinary.' WHERE name = 'Scorpions migration' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'This diaphanous mirage has been luring travellers out of their way for eons.' WHERE name = 'Diaphanous mirage' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'The Lecorno Sinkhole. Locals claim that it is completely flooded.' WHERE name = 'Lecorno Sinkhole' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'A sprawling necropolis built within a labyrinthine network of catacombs. Its halls are lined with countless alcoves, each housing the remains of the departed, while the distant sound of rattling bones fills the air' WHERE name = 'Anellonedito Mausoleum' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Polar Breeze Dungeon - Found by Kaelen and Repeatable' WHERE name = 'Polar Breeze' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'The Gnolls'' Transgression - Rank A Dungeon Found by Drew and Brady' WHERE name = 'The Gnolls Transgression' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Rob - Rocky Roads dungeon' WHERE name = 'Rocky Roads' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Found by Rob' WHERE name = 'Flying Issues' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'found by luke' WHERE name = 'Imp Problem' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'found by kaelen' WHERE name = 'Decisions Decisions' AND (description IS NULL OR description = '');
UPDATE map_markers SET description = 'Found by Drew' WHERE name = 'Rainbow Roads' AND (description IS NULL OR description = '');