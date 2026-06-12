-- Populate map_markers descriptions and populations from Azgaar .map file
-- Run AFTER: sql/add_population_column.sql
-- Overwrites any existing descriptions

-- SETTLEMENTS (population + description)

UPDATE map_markers SET description = 'Population: ~6,213
Features: capital, citadel, walls, plaza', population = 6213 WHERE name = 'Altash' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~6,096
Type: Naval
Features: capital, port, citadel, walls', population = 6096 WHERE name = 'Newbrag' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~28,323
Features: capital, citadel, walls, plaza', population = 28323 WHERE name = 'Cleobury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~5,600
Type: Naval
Features: capital, port, citadel, walls, plaza', population = 5600 WHERE name = 'Redcke' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~35,064
Features: capital, citadel, walls, temple, plaza, shanty town', population = 35064 WHERE name = 'Birwick' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~14,180
Features: capital, citadel, walls', population = 14180 WHERE name = 'Cliford' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~9,948
Type: Naval
Features: capital, port, citadel, walls, plaza', population = 9948 WHERE name = 'Wicksey' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~7,471', population = 7471 WHERE name = 'Solescom' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~27,595
Type: Naval
Features: port, citadel, walls', population = 27595 WHERE name = 'Retbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~7,871
Features: citadel', population = 7871 WHERE name = 'Fihul' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~9,921
Features: citadel, walls', population = 9921 WHERE name = 'Saleton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,159
Type: Hunting
Features: citadel', population = 2159 WHERE name = 'Berlisham' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~16,298
Features: walls', population = 16298 WHERE name = 'Lurymocksey' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~10,341
Type: Naval
Features: port, walls', population = 10341 WHERE name = 'Portsmouth' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~18,727
Type: Lake
Features: walls, plaza', population = 18727 WHERE name = 'Orneton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,658
Type: Hunting
Features: citadel', population = 1658 WHERE name = 'Quatbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~10,939
Features: plaza', population = 10939 WHERE name = 'Winewentham' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~16,759
Features: plaza', population = 16759 WHERE name = 'Hendoneton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~11,795
Features: citadel, walls, plaza', population = 11795 WHERE name = 'Malcester' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~10,076
Type: Naval
Features: port, citadel, walls, plaza', population = 10076 WHERE name = 'Redckerbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,721
Type: Hunting
Features: citadel, plaza', population = 1721 WHERE name = 'Congton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~22,057
Features: citadel, walls, temple, shanty town', population = 22057 WHERE name = 'Westham' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~8,747
Features: citadel, walls', population = 8747 WHERE name = 'Hathorough' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~3,255
Type: Naval
Features: port, citadel', population = 3255 WHERE name = 'Draxtedley' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~4,274
Type: Lake
Features: citadel, walls', population = 4274 WHERE name = 'Atford' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,795
Type: Hunting', population = 1795 WHERE name = 'Chawbigton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~13,917
Features: citadel, walls', population = 13917 WHERE name = 'Hertes' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~24,414
Type: Naval
Features: port, walls, plaza', population = 24414 WHERE name = 'Albrid' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,930
Type: Hunting
Features: citadel', population = 2930 WHERE name = 'Prescastle' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~8,323', population = 8323 WHERE name = 'Albrole' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~11,982
Features: citadel, walls, plaza', population = 11982 WHERE name = 'Redclescom' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~9,365
Features: plaza', population = 9365 WHERE name = 'Baltashet' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~7,062
Type: Naval
Features: port', population = 7062 WHERE name = 'Boston' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~6,115
Features: citadel', population = 6115 WHERE name = 'Nosterton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,369
Type: Hunting
Features: citadel', population = 2369 WHERE name = 'Burwicksey' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~24,676
Type: Naval
Features: port, citadel, walls, shanty town', population = 24676 WHERE name = 'Louthestow' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,594
Type: Hunting', population = 1594 WHERE name = 'Hornmouth' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,587
Type: Hunting', population = 1587 WHERE name = 'Presmouth' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,595
Type: Hunting
Features: citadel, walls', population = 1595 WHERE name = 'Maldon' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~11,747
Type: Naval
Features: port, citadel, walls, plaza', population = 11747 WHERE name = 'Skipingin' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~5,268
Type: Hunting', population = 5268 WHERE name = 'Presham' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~3,337
Type: Hunting', population = 3337 WHERE name = 'Hitchetford' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~18,593
Type: Naval
Features: port, walls, plaza', population = 18593 WHERE name = 'Macham' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~8,411
Type: Naval
Features: port, citadel', population = 8411 WHERE name = 'Casthesore' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,568
Type: Hunting', population = 1568 WHERE name = 'Oakleigh' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~6,007
Features: citadel', population = 6007 WHERE name = 'Bothone' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~10,833
Features: walls, plaza', population = 10833 WHERE name = 'Newleighton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,631
Type: Naval
Features: port', population = 2631 WHERE name = 'Quatford' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,999
Type: Hunting
Features: walls', population = 1999 WHERE name = 'Presterby' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~19,876
Type: Naval
Features: port, citadel', population = 19876 WHERE name = 'Towleigh' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,775
Type: Hunting
Features: citadel, plaza', population = 2775 WHERE name = 'Alewichet' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,022
Type: Hunting
Features: citadel', population = 2022 WHERE name = 'Maldockley' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~20,957
Features: walls, temple, shanty town', population = 20957 WHERE name = 'Aymouthing' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~8,637
Features: citadel', population = 8637 WHERE name = 'Pilmondling' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~22,449
Type: Naval
Features: port, citadel, walls, plaza, shanty town', population = 22449 WHERE name = 'Wacury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,017
Type: Hunting
Features: citadel, walls, plaza', population = 2017 WHERE name = 'Apledine' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,733
Type: Hunting', population = 1733 WHERE name = 'Warton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~3,123
Type: Hunting', population = 3123 WHERE name = 'Atford' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,586
Type: Naval
Features: port', population = 2586 WHERE name = 'Balterham' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~44,043
Features: citadel, walls, plaza, shanty town', population = 44043 WHERE name = 'Bunter' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~10,193
Features: citadel, plaza', population = 10193 WHERE name = 'Mackingmo' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~3,100
Type: Hunting
Features: walls', population = 3100 WHERE name = 'Clitletown' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,359
Type: Hunting
Features: walls', population = 2359 WHERE name = 'Bateslewen' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~6,270
Features: citadel, plaza', population = 6270 WHERE name = 'Granton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~8,992
Features: citadel', population = 8992 WHERE name = 'Southbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,103
Type: Lake
Features: plaza', population = 2103 WHERE name = 'Boltash' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~13,325
Features: walls', population = 13325 WHERE name = 'Sherster' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~3,486
Type: Hunting
Features: plaza', population = 3486 WHERE name = 'Watbutondo' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~15,647
Features: citadel, plaza', population = 15647 WHERE name = 'Brasterton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~10,513
Features: citadel, walls, plaza', population = 10513 WHERE name = 'Rothwelme' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~3,126
Type: Hunting
Features: plaza', population = 3126 WHERE name = 'Causinta' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,744
Type: Hunting', population = 2744 WHERE name = 'Knabingin' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~5,561
Type: Hunting
Features: plaza', population = 5561 WHERE name = 'Shorough' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~12,889
Features: citadel, walls', population = 12889 WHERE name = 'Albletondo' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,937
Type: Hunting
Features: walls', population = 1937 WHERE name = 'Tarfordmin' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~10,647
Features: citadel, plaza', population = 10647 WHERE name = 'Skiple' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~9,798', population = 9798 WHERE name = 'Dodbrid' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~12,114', population = 12114 WHERE name = 'Matestoney' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~12,586
Type: Highland
Features: walls, plaza', population = 12586 WHERE name = 'Northam' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~8,877
Features: citadel, plaza', population = 8877 WHERE name = 'Bodbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~9,828', population = 9828 WHERE name = 'Boliver' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~6,112
Features: walls', population = 6112 WHERE name = 'Tarley' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~12,907
Features: walls, plaza', population = 12907 WHERE name = 'Daltonzan' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,218
Type: Hunting
Features: walls', population = 1218 WHERE name = 'Abingtonton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~7,481', population = 7481 WHERE name = 'Rearale' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~7,340
Features: citadel, plaza', population = 7340 WHERE name = 'Etonzan' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~17,301
Features: citadel, walls', population = 17301 WHERE name = 'Warley' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~17,061
Features: citadel, plaza', population = 17061 WHERE name = 'Brasbutondo' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~22,671
Type: Naval
Features: port, walls, temple, plaza, shanty town', population = 22671 WHERE name = 'Clifractho' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~12,318
Features: citadel, walls, plaza', population = 12318 WHERE name = 'Horndoke' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~13,728
Features: citadel, walls', population = 13728 WHERE name = 'Peneymock' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~21,093
Features: walls, plaza', population = 21093 WHERE name = 'Cocking' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~17,172
Features: walls, plaza', population = 17172 WHERE name = 'Grantbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~4,448
Type: Hunting', population = 4448 WHERE name = 'Forough' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~8,779
Features: plaza', population = 8779 WHERE name = 'Bivewent' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~14,984
Features: walls, plaza', population = 14984 WHERE name = 'Ormscom' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~8,768
Features: citadel', population = 8768 WHERE name = 'Soutbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,606
Type: Hunting
Features: citadel', population = 1606 WHERE name = 'Alborbot' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,681
Type: Hunting
Features: citadel', population = 1681 WHERE name = 'Newbigin' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~6,268
Features: citadel', population = 6268 WHERE name = 'Grantford' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,546
Type: Hunting
Features: citadel', population = 1546 WHERE name = 'Clifton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~10,804
Features: citadel, plaza', population = 10804 WHERE name = 'Burbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~8,393
Features: walls', population = 8393 WHERE name = 'Norlingham' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~10,006', population = 10006 WHERE name = 'Beryme' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,617
Type: Hunting
Features: citadel', population = 1617 WHERE name = 'Camblemade' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~18,784
Features: plaza', population = 18784 WHERE name = 'Gatbuton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,113
Type: Hunting
Features: plaza', population = 2113 WHERE name = 'Luryteston' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~4,103
Type: Hunting
Features: walls', population = 4103 WHERE name = 'Exning' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,888
Features: citadel, walls', population = 2888 WHERE name = 'Atesleley' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,681
Type: Hunting
Features: plaza', population = 1681 WHERE name = 'Dymockwar' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~9,161', population = 9161 WHERE name = 'Solineton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~9,132', population = 9132 WHERE name = 'Presmouth' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,784
Type: Hunting', population = 1784 WHERE name = 'Compound' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~12,641
Features: plaza', population = 12641 WHERE name = 'Preston' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~4,342
Type: Hunting', population = 4342 WHERE name = 'Sudmouthin' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,769
Type: Naval
Features: port, citadel', population = 1769 WHERE name = 'Withole' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~5,400
Type: Naval
Features: port', population = 5400 WHERE name = 'Padsbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,208
Type: Hunting
Features: plaza', population = 1208 WHERE name = 'Ormstoney' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~21,280
Features: citadel, walls, plaza', population = 21280 WHERE name = 'Oltoningt' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,014
Type: Hunting', population = 1014 WHERE name = 'Wickneth' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,853
Type: Naval
Features: port, citadel, walls', population = 2853 WHERE name = 'Baldock' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~5,606
Type: Hunting
Features: citadel', population = 5606 WHERE name = 'Clifnal' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,944
Type: Hunting
Features: citadel, plaza', population = 1944 WHERE name = 'Kihulsea' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~11,212
Type: Naval
Features: port, citadel, walls, plaza', population = 11212 WHERE name = 'Newborough' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~9,114
Features: plaza', population = 9114 WHERE name = 'Tresorough' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~17,936
Features: citadel, walls, plaza', population = 17936 WHERE name = 'Witfordle' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~13,144
Features: citadel, plaza', population = 13144 WHERE name = 'Helstabrigh' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~3,838
Type: Hunting', population = 3838 WHERE name = 'Sherscombe' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,636
Type: Hunting', population = 1636 WHERE name = 'Rockerne' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,916
Type: Hunting
Features: citadel', population = 1916 WHERE name = 'Kilkham' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~11,095
Features: citadel, plaza', population = 11095 WHERE name = 'Nostabro' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~7,483', population = 7483 WHERE name = 'Netondal' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~6,264
Features: citadel', population = 6264 WHERE name = 'Chipton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,553
Type: Hunting
Features: citadel', population = 1553 WHERE name = 'Cleobury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,276
Features: citadel', population = 1276 WHERE name = 'Berford' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~13,021
Features: walls', population = 13021 WHERE name = 'Mitherden' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~15,587
Features: citadel, walls, plaza', population = 15587 WHERE name = 'Winkburgh' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~10,024', population = 10024 WHERE name = 'Skiple' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~15,295
Features: plaza', population = 15295 WHERE name = 'Weningthe' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~5,394
Type: Hunting', population = 5394 WHERE name = 'Ormsham' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,355
Type: Hunting
Features: plaza', population = 1355 WHERE name = 'Antonley' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~5,623
Type: Hunting', population = 5623 WHERE name = 'Skipington' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~15,468
Features: walls, plaza', population = 15468 WHERE name = 'Moden' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,667
Type: Hunting
Features: citadel', population = 1667 WHERE name = 'Midgesey' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~13,401
Features: citadel, walls, plaza', population = 13401 WHERE name = 'Maldondal' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,887
Type: Hunting', population = 1887 WHERE name = 'Hinckneth' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~31,631
Type: Naval
Features: port, citadel, walls, temple, plaza', population = 31631 WHERE name = 'Cleomyard' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~8,218
Type: Naval
Features: port, citadel, walls', population = 8218 WHERE name = 'Yeorough' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~8,855
Features: plaza', population = 8855 WHERE name = 'Cudgedon' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~31,471
Type: Naval
Features: port, walls, plaza', population = 31471 WHERE name = 'Thatclester' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,827
Type: Hunting
Features: citadel, walls', population = 1827 WHERE name = 'Whitlexeton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~12,118', population = 12118 WHERE name = 'Wishead' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,057
Type: Hunting
Features: citadel', population = 2057 WHERE name = 'Portsho' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~15,952
Type: Lake
Features: walls', population = 15952 WHERE name = 'Lympston' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,612
Type: Hunting
Features: citadel', population = 1612 WHERE name = 'Ormsfieldbu' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,038
Type: Hunting
Features: citadel', population = 2038 WHERE name = 'Barton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~15,762
Features: plaza', population = 15762 WHERE name = 'Merhamney' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~5,884
Type: Hunting', population = 5884 WHERE name = 'Wigtonor' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~961
Type: Hunting
Features: citadel', population = 961 WHERE name = 'Piclif' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~12,937
Type: Naval
Features: port, citadel', population = 12937 WHERE name = 'Bolton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~9,052', population = 9052 WHERE name = 'Burleigh' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~9,415
Features: citadel', population = 9415 WHERE name = 'Warwick' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,804
Type: Hunting
Features: citadel', population = 1804 WHERE name = 'Dunsbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~18,672
Features: citadel, walls, plaza', population = 18672 WHERE name = 'Wisbuton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,088
Type: Hunting
Features: citadel', population = 2088 WHERE name = 'Macham' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~11,503
Features: walls', population = 11503 WHERE name = 'Carlingley' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,086
Type: Lake
Features: citadel', population = 1086 WHERE name = 'Yeorough' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,865
Type: Hunting
Features: citadel, plaza', population = 1865 WHERE name = 'Crafthers' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~14,287
Type: Naval
Features: port, walls', population = 14287 WHERE name = 'Padsterpor' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~20,975
Features: walls, plaza, shanty town', population = 20975 WHERE name = 'Kirfordling' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,792
Type: Naval
Features: port, walls, plaza', population = 2792 WHERE name = 'Bostontef' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~20,232
Type: Naval
Features: port, walls, temple, plaza', population = 20232 WHERE name = 'Tutleter' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~3,407
Type: Naval
Features: port, citadel, plaza', population = 3407 WHERE name = 'Shersfield' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~8,817', population = 8817 WHERE name = 'Witford' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~9,767
Features: plaza', population = 9767 WHERE name = 'Calneydon' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~10,567
Features: walls, plaza', population = 10567 WHERE name = 'Shorough' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,300
Type: Hunting
Features: citadel', population = 2300 WHERE name = 'Dodbrigh' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~3,851
Type: Hunting
Features: citadel, plaza', population = 3851 WHERE name = 'Shersterke' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~4,311
Type: Hunting
Features: plaza', population = 4311 WHERE name = 'Clifton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,728
Type: Hunting
Features: plaza', population = 1728 WHERE name = 'Maclif' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~10,975
Type: Naval
Features: port, citadel, walls, plaza', population = 10975 WHERE name = 'Mitre' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~24,666
Type: Lake
Features: citadel, walls, plaza', population = 24666 WHERE name = 'Burton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~4,239
Type: Hunting
Features: citadel', population = 4239 WHERE name = 'Stotre' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,939
Type: Naval
Features: port, citadel', population = 2939 WHERE name = 'Craftford' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~12,655
Type: Naval
Features: port, citadel', population = 12655 WHERE name = 'Apleford' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,845
Type: Hunting
Features: citadel, walls, plaza', population = 1845 WHERE name = 'Whithers' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~6,120
Features: plaza', population = 6120 WHERE name = 'Wargrading' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~37,704
Features: walls, temple, plaza', population = 37704 WHERE name = 'Watham' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~9,748
Features: citadel', population = 9748 WHERE name = 'Cliford' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,228
Type: Hunting', population = 1228 WHERE name = 'Guildlingmo' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~13,874
Type: Naval
Features: port, citadel, walls, plaza', population = 13874 WHERE name = 'Malseading' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,690
Type: Hunting
Features: plaza', population = 1690 WHERE name = 'Chisbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~13,427
Features: citadel, plaza', population = 13427 WHERE name = 'Draxted' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,107
Type: Hunting', population = 1107 WHERE name = 'Boneton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,769
Type: Hunting
Features: citadel', population = 1769 WHERE name = 'Corewester' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~7,949', population = 7949 WHERE name = 'Chiswest' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,732
Type: Hunting
Features: plaza', population = 1732 WHERE name = 'Apton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,592
Type: Hunting', population = 1592 WHERE name = 'Thaxning' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,526
Type: Hunting
Features: walls', population = 1526 WHERE name = 'Picker' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~16,835
Type: Lake
Features: citadel, walls, plaza', population = 16835 WHERE name = 'Hatfordley' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~7,142
Features: citadel', population = 7142 WHERE name = 'Chawleigh' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~9,194
Type: Lake
Features: walls', population = 9194 WHERE name = 'Bingley' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~6,418
Features: citadel', population = 6418 WHERE name = 'Ostabrigh' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~16,261
Type: Naval
Features: port', population = 16261 WHERE name = 'Lympston' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~15,618
Features: plaza', population = 15618 WHERE name = 'Nosterwick' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~11,839
Features: citadel, walls', population = 11839 WHERE name = 'Axbrid' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,831
Type: Hunting
Features: walls', population = 2831 WHERE name = 'Wathorough' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~7,598
Features: citadel, plaza', population = 7598 WHERE name = 'Padsbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,414
Type: Hunting
Features: citadel, walls, plaza', population = 1414 WHERE name = 'Perscom' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,088
Type: Hunting
Features: plaza', population = 1088 WHERE name = 'Retbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~725
Features: citadel, walls', population = 725 WHERE name = 'Aldockley' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~4,142
Type: Hunting
Features: plaza', population = 4142 WHERE name = 'Boling' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,777
Type: Hunting
Features: plaza', population = 1777 WHERE name = 'Linley' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~697
Features: citadel', population = 697 WHERE name = 'Framping' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~9,247
Features: citadel', population = 9247 WHERE name = 'Daldock' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~7,519', population = 7519 WHERE name = 'Whitfieldbu' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~7,969
Features: plaza', population = 7969 WHERE name = 'Cambridbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~8,250', population = 8250 WHERE name = 'Cambridge' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,124
Type: Hunting
Features: walls', population = 1124 WHERE name = 'Darwick' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~3,890
Type: Hunting
Features: walls', population = 3890 WHERE name = 'Tinerereby' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~9,455
Type: Lake', population = 9455 WHERE name = 'Barton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~8,160', population = 8160 WHERE name = 'Madingin' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~9,620
Features: plaza', population = 9620 WHERE name = 'Holboverton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~6,705
Features: citadel, walls', population = 6705 WHERE name = 'Hatford' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,696
Type: Hunting', population = 1696 WHERE name = 'Cambridmin' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~7,665
Features: plaza', population = 7665 WHERE name = 'Saldock' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~4,513
Type: Hunting', population = 4513 WHERE name = 'Holing' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~976
Type: Hunting
Features: citadel', population = 976 WHERE name = 'Hatbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~4,004
Features: walls', population = 4004 WHERE name = 'Stapton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~653', population = 653 WHERE name = 'Charnehole' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,763
Type: Hunting
Features: citadel, walls', population = 1763 WHERE name = 'Childock' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,723
Type: Hunting', population = 2723 WHERE name = 'Rothetbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,253
Type: Naval
Features: port, citadel, walls', population = 2253 WHERE name = 'Thatclesto' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~12,646
Type: Lake
Features: walls, plaza', population = 12646 WHERE name = 'Cleowey' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~6,211
Features: citadel', population = 6211 WHERE name = 'Towleigh' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,865
Type: Hunting
Features: citadel', population = 1865 WHERE name = 'Hatfordge' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~8,920
Features: citadel, walls, plaza', population = 8920 WHERE name = 'Winkham' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~957
Features: plaza', population = 957 WHERE name = 'Wargham' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~10,753
Features: plaza', population = 10753 WHERE name = 'Launterton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~9,688', population = 9688 WHERE name = 'Harford' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,357
Type: Hunting
Features: walls, plaza', population = 1357 WHERE name = 'Tihulton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~8,646
Features: citadel', population = 8646 WHERE name = 'Dunstolelis' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,750', population = 1750 WHERE name = 'Withamburgh' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~11,553
Type: Naval
Features: port, walls', population = 11553 WHERE name = 'Axbrigh' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~8,633', population = 8633 WHERE name = 'Dunstorough' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~5,630
Features: citadel, plaza', population = 5630 WHERE name = 'Presfield' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,688
Type: Hunting', population = 1688 WHERE name = 'Westfordge' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,736
Type: Hunting
Features: citadel, walls, plaza', population = 1736 WHERE name = 'Altondoke' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,097
Type: Lake
Features: citadel, plaza', population = 1097 WHERE name = 'Maclescom' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~20,269
Features: walls, temple, plaza', population = 20269 WHERE name = 'Herthe' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~8,241', population = 8241 WHERE name = 'Felton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~12,960
Features: plaza', population = 12960 WHERE name = 'Bingdon' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~7,721
Features: citadel, walls', population = 7721 WHERE name = 'Watherton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,724
Type: Hunting
Features: citadel, walls', population = 1724 WHERE name = 'Noscom' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,598
Type: Hunting
Features: citadel', population = 1598 WHERE name = 'Kirden' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~646
Features: plaza', population = 646 WHERE name = 'Grantleter' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,943
Type: Hunting
Features: citadel, walls, plaza', population = 1943 WHERE name = 'Holterming' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~649
Features: plaza', population = 649 WHERE name = 'Chipton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~3,835
Type: Naval
Features: port, citadel, plaza', population = 3835 WHERE name = 'Shersted' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~9,048
Features: citadel, walls', population = 9048 WHERE name = 'Preshambe' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,916
Type: Hunting', population = 2916 WHERE name = 'Congton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~5,607
Features: citadel', population = 5607 WHERE name = 'Whithe' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~11,936
Features: citadel, plaza', population = 11936 WHERE name = 'Tarbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~8,691
Features: citadel', population = 8691 WHERE name = 'Harington' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~5,954
Type: Hunting
Features: citadel, walls, plaza', population = 5954 WHERE name = 'Towcestery' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,131
Type: Hunting
Features: citadel, plaza', population = 1131 WHERE name = 'Hinckwarton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~21,669
Features: citadel, walls, plaza, shanty town', population = 21669 WHERE name = 'Axbridge' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,952
Type: Hunting
Features: walls, plaza', population = 2952 WHERE name = 'Yeorough' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,577
Type: Hunting
Features: citadel', population = 1577 WHERE name = 'Boldon' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~10,471
Features: plaza', population = 10471 WHERE name = 'Birdenton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,662
Features: citadel', population = 1662 WHERE name = 'Penkham' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,348
Type: Hunting
Features: plaza', population = 2348 WHERE name = 'Marshester' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,050
Type: Hunting', population = 2050 WHERE name = 'Wishamney' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~12,626
Features: walls', population = 12626 WHERE name = 'Horsbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,107
Type: Hunting
Features: plaza', population = 2107 WHERE name = 'Launterford' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~6,594', population = 6594 WHERE name = 'Godbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~4,296
Features: plaza', population = 4296 WHERE name = 'Oakhampton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,157
Type: Lake', population = 1157 WHERE name = 'Bodbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~665', population = 665 WHERE name = 'Brolideton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,606
Type: Hunting
Features: plaza', population = 1606 WHERE name = 'Wodling' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,084
Type: Hunting
Features: citadel, plaza', population = 1084 WHERE name = 'Thatcheap' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~695
Features: plaza', population = 695 WHERE name = 'Westcheap' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~3,822
Features: citadel', population = 3822 WHERE name = 'Sidgeroere' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~7,912', population = 7912 WHERE name = 'Apton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~9,231
Type: Naval
Features: port, plaza', population = 9231 WHERE name = 'Atfordleby' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~6,717
Type: Lake', population = 6717 WHERE name = 'Lympsted' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~14,915
Features: walls, plaza', population = 14915 WHERE name = 'Dunswest' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,723
Type: Hunting
Features: citadel', population = 1723 WHERE name = 'Dunshorough' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~13,834
Features: citadel, walls, plaza', population = 13834 WHERE name = 'Whitford' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~6,401
Features: citadel', population = 6401 WHERE name = 'Ashwelbore' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~932
Features: citadel, plaza', population = 932 WHERE name = 'Hinckhambe' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~6,188
Features: citadel', population = 6188 WHERE name = 'Machamber' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~7,226
Features: citadel', population = 7226 WHERE name = 'Normouthes' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~6,576', population = 6576 WHERE name = 'Whitford' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~598
Features: citadel', population = 598 WHERE name = 'Dudbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~12,187
Type: Lake
Features: citadel', population = 12187 WHERE name = 'Oltery' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,908
Type: Lake
Features: citadel', population = 2908 WHERE name = 'Chistorough' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~15,110
Type: Naval
Features: port, walls, plaza', population = 15110 WHERE name = 'Searare' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~3,234
Features: citadel, plaza', population = 3234 WHERE name = 'Pickingin' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~825', population = 825 WHERE name = 'Warton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~6,926
Features: citadel', population = 6926 WHERE name = 'Thaxtedbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~8,207
Features: citadel', population = 8207 WHERE name = 'Framping' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~3,498
Type: Highland
Features: citadel', population = 3498 WHERE name = 'Marshwel' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,290', population = 1290 WHERE name = 'Bridge' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~15,367
Features: citadel, plaza', population = 15367 WHERE name = 'Paigntabing' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,010
Type: Hunting
Features: citadel, walls', population = 2010 WHERE name = 'Dodbridge' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~643
Features: citadel', population = 643 WHERE name = 'Berming' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~5,904
Type: Hunting
Features: citadel', population = 5904 WHERE name = 'Warton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,535
Type: Hunting
Features: citadel, walls, plaza', population = 1535 WHERE name = 'Cartondon' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~691', population = 691 WHERE name = 'Olmebymock' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~3,209
Type: Hunting', population = 3209 WHERE name = 'Macker' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,122
Type: Lake', population = 2122 WHERE name = 'Oakhampton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~4,010', population = 4010 WHERE name = 'Dodbrighes' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~3,754
Features: citadel, plaza', population = 3754 WHERE name = 'Treley' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~3,375
Type: Hunting', population = 3375 WHERE name = 'Watchwark' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,160
Type: Hunting
Features: citadel', population = 1160 WHERE name = 'Herton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,101
Type: Hunting
Features: walls', population = 1101 WHERE name = 'Albrid' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,008
Type: Hunting
Features: citadel', population = 2008 WHERE name = 'Bostowbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~22,004
Features: temple, plaza', population = 22004 WHERE name = 'Mabington' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~783
Features: citadel', population = 783 WHERE name = 'Shifnal' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~680
Features: citadel, plaza', population = 680 WHERE name = 'Chiplere' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~3,983', population = 3983 WHERE name = 'Mabingley' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,177
Type: Hunting
Features: citadel', population = 1177 WHERE name = 'Knamers' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~684
Features: citadel, plaza', population = 684 WHERE name = 'Dunston' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,711
Type: Hunting
Features: walls', population = 1711 WHERE name = 'Tetham' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~18,617
Features: citadel, walls, plaza', population = 18617 WHERE name = 'Draxted' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~6,672
Features: citadel', population = 6672 WHERE name = 'Rethampound' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~5,356', population = 5356 WHERE name = 'Stanwichton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,870
Features: plaza', population = 2870 WHERE name = 'Athambe' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~690', population = 690 WHERE name = 'Wavesey' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~5,191
Type: Hunting
Features: walls', population = 5191 WHERE name = 'Cambridbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,360
Features: citadel', population = 2360 WHERE name = 'Uxbrighwel' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~670
Features: citadel', population = 670 WHERE name = 'Nosfieldge' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,003
Features: citadel', population = 1003 WHERE name = 'Mitleven' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,428
Type: Hunting', population = 2428 WHERE name = 'Horsterley' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~10,595
Features: citadel, plaza', population = 10595 WHERE name = 'Carton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~3,286
Features: citadel', population = 3286 WHERE name = 'Craftfordge' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~749
Features: citadel', population = 749 WHERE name = 'Childockley' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,192', population = 2192 WHERE name = 'Boston' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~748
Features: walls', population = 748 WHERE name = 'Thaxningley' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,970
Type: Hunting
Features: citadel, plaza', population = 1970 WHERE name = 'Bether' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,789
Type: Hunting
Features: citadel', population = 1789 WHERE name = 'Sorough' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~12,471
Features: citadel, walls, plaza', population = 12471 WHERE name = 'Stotbume' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~721
Features: citadel', population = 721 WHERE name = 'Westfordmin' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~10,088
Features: citadel, plaza', population = 10088 WHERE name = 'Horster' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,937
Type: Hunting
Features: citadel', population = 1937 WHERE name = 'Binetonor' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,865
Features: plaza', population = 2865 WHERE name = 'Mantefract' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~3,596
Type: Hunting
Features: citadel, plaza', population = 3596 WHERE name = 'Brastonta' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,561
Type: Hunting
Features: citadel, plaza', population = 1561 WHERE name = 'Penkham' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~636
Features: plaza', population = 636 WHERE name = 'Caltonceso' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,836
Features: citadel', population = 2836 WHERE name = 'Congton' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~2,399', population = 2399 WHERE name = 'Harbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~4,825
Features: citadel, plaza', population = 4825 WHERE name = 'Stansbury' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~1,123
Type: Hunting', population = 1123 WHERE name = 'Thetford' AND type IN ('city','town');
UPDATE map_markers SET description = 'Population: ~4,192
Features: citadel', population = 4192 WHERE name = 'Betesfield' AND type IN ('city','town');

-- EXTRA MARKERS (descriptions only)

UPDATE map_markers SET description = 'Dormant volcano. Height: 9216 ft.' WHERE name = 'Sidmanch Volcano';
UPDATE map_markers SET description = 'A geothermal springs with naturally heated water that provide relaxation and medicinal benefits. Average temperature is 104°F.' WHERE name = 'Montemiterva';
UPDATE map_markers SET description = 'This legendary water source is whispered about in ancient tales and believed to possess mystical properties. The spring emanates crystal-clear water, shimmering with an otherworldly iridescence that sparkles even in the dimmest light.' WHERE name = 'Rocca Creek of Luck';
UPDATE map_markers SET description = 'Collano is a mining town of 670 people just nearby the iron mine.' WHERE name = 'Collano — iron mining town';
UPDATE map_markers SET description = 'A lengthy bridge spans over the Anilia River near Patroniale.' WHERE name = 'Patroniale Bridge';
UPDATE map_markers SET description = 'A rickety bridge spans over the Feteviglio River near Anovolinoli.' WHERE name = 'Anovolinoli Bridge';
UPDATE map_markers SET description = 'A big and famous roadside tavern. Delicious dried spinach with smelly cider is served here.' WHERE name = 'The Divine Tavern';
UPDATE map_markers SET description = 'A big and famous roadside tavern. Delicious dry-aged onions with bitter wine is served here.' WHERE name = 'The Bright Buffalo';
UPDATE map_markers SET description = 'A lighthouse to serve as a beacon for ships in the open sea.' WHERE name = 'Rigian Lighthouse';
UPDATE map_markers SET description = 'A historical battle of the Nespotenian War. Date: August 11, 678 Haltash Era.' WHERE name = 'Guildgeton Battlefield';
UPDATE map_markers SET description = 'A historical battle of the Antaranian Conquest. Date: January 13, 714 Haltash Era.' WHERE name = 'Citrico Battlefield';
UPDATE map_markers SET description = 'A historical battle of the Nespotenian War. Date: September 5, 685 Haltash Era.' WHERE name = 'Altford Battlefield';
UPDATE map_markers SET description = 'Legends say a relic monster of 16 ft long inhabits Monteta Lake. Truth or lie, folks are afraid to fish in the lake.' WHERE name = 'Monteta Monster';
UPDATE map_markers SET description = 'Old sailors tell stories of a gigantic sea monster inhabiting these dangerous waters. Rumors say it can be 25 ft long.' WHERE name = 'Arester Monster';
UPDATE map_markers SET description = 'Journeying folk speak of a terrifying Warg who inhabits Pontitellet hills and harasses travelers in the area.' WHERE name = 'Pontitellet Warg';
UPDATE map_markers SET description = 'A forest sacred to local Tallian Spirits.' WHERE name = 'Collegiomeri Forest';
UPDATE map_markers SET description = 'A pinery sacred to local Tallian Spirits.' WHERE name = 'Sezali Pinery';
UPDATE map_markers SET description = 'A palm grove sacred to local Tallian Spirits.' WHERE name = 'Vinonianone Palm Grove';
UPDATE map_markers SET description = 'A gang of forest brigands.' WHERE name = 'Scando Spiders';
UPDATE map_markers SET description = 'A gang of forest bandits.' WHERE name = 'Gorro Beavers';
UPDATE map_markers SET description = 'Pirate ships have been spotted in these waters.' WHERE name = 'Pirates';
UPDATE map_markers SET description = 'Pirate ships have been spotted in these waters.' WHERE name = 'Pirates';
UPDATE map_markers SET description = 'An ancient statue. It has an inscription, but no one can translate it: ⳐⳞ ⳆⳃⲸⳂⳄⲼⳂⲺ ⲴⳬⳄ⳾⳹ⳘⳘⳜⲲ Ⳡ Ⳡ⳥ⲾⲶⳌⳭⳈⳞⳔ ⳆⳆⳬ ⳂⳠ ⳜⳚⳞ⳥⳾ⳄⳫⳌⲾⳫⳔⳠⳘⳄ ⳁ⳧' WHERE name = 'Bramburgh Statue';
UPDATE map_markers SET description = 'An ancient runestone. It has an inscription, but no one can translate it: 𐠘𐠃𐠑𐠜𐠲𐠃𐠐𐠢𐠫𐠂𐠤 𐠧𐠵𐠩𐠴𐠗𐠬 𐠛𐠰𐠡' WHERE name = 'Montigliase Runestone';
UPDATE map_markers SET description = 'An ancient idol. It has an inscription, but no one can translate it: 𐠯𐠳𐠋𐠎𐠝 𐠿𐠟𐠔𐠒 𐠒𐠝 𐠛𐠝 ' WHERE name = 'Scandrigna Idol';
UPDATE map_markers SET description = 'Ruins of an ancient outpost. Untold riches may lie within.' WHERE name = 'Ruined Outpost';
UPDATE map_markers SET description = 'Ruins of an ancient castle. Untold riches may lie within.' WHERE name = 'Ruined Castle';
UPDATE map_markers SET description = 'Ruins of an ancient outpost. Untold riches may lie within.' WHERE name = 'Ruined Outpost';
UPDATE map_markers SET description = 'A vast collection of knowledge, including many rare and ancient tomes.' WHERE name = 'Belleno Collection';
UPDATE map_markers SET description = 'Roll up, roll up, this breathtaking circus is here for a limited time only.' WHERE name = 'Travelling Breathtaking Circus';
UPDATE map_markers SET description = 'Warriors from around the land gather for a joust of the greats in Conti, with fame, fortune and favour on offer to the victor.' WHERE name = 'Conti Joust';
UPDATE map_markers SET description = 'A fair is being held in Camba, with all manner of local and foreign goods and services on offer.' WHERE name = 'Camba Fair';
UPDATE map_markers SET description = 'A small location along the Casco River to launch boats from sits here, along with a weary looking owner, willing to sell passage along the river.' WHERE name = 'Minor Jetty';
UPDATE map_markers SET description = 'A huge group of scorpions are migrating, whether part of their annual routine, or something more extraordinary.' WHERE name = 'Scorpions migration';
UPDATE map_markers SET description = 'This diaphanous mirage has been luring travellers out of their way for eons.' WHERE name = 'Diaphanous mirage';
UPDATE map_markers SET description = 'The Lecorno Sinkhole. Locals claim that it is completely flooded.' WHERE name = 'Lecorno Sinkhole';
UPDATE map_markers SET description = 'A sprawling necropolis built within a labyrinthine network of catacombs. Its halls are lined with countless alcoves, each housing the remains of the departed, while the distant sound of rattling bones fills the air' WHERE name = 'Anellonedito Mausoleum';
UPDATE map_markers SET description = 'Polar Breeze Dungeon - Found by Kaelen and Repeatable' WHERE name = 'Polar Breeze';
UPDATE map_markers SET description = 'The Gnolls'' Transgression - Rank A Dungeon Found by Drew and Brady' WHERE name = 'The Gnolls Transgression';
UPDATE map_markers SET description = 'Rob - Rocky Roads dungeon' WHERE name = 'Rocky Roads';
UPDATE map_markers SET description = 'Found by Rob' WHERE name = 'Flying Issues';
UPDATE map_markers SET description = 'found by luke' WHERE name = 'Imp Problem';
UPDATE map_markers SET description = 'found by kaelen' WHERE name = 'Decisions Decisions';
UPDATE map_markers SET description = 'Found by Drew' WHERE name = 'Rainbow Roads';