alter table public.products drop constraint if exists products_category_check;
alter table public.products
  add constraint products_category_check
  check (category in ('Pantallas', 'Cámaras traseras', 'Flex pin de carga', 'Baterías'));

insert into public.products (
  id, category, brand, model, product_type, variant, reference,
  price_1, price_2, price_3, available, active
) values
('fb0016','Baterías','iPhone','XSMax','Batería','XSMAXIP3174BRGF','FB0016',750,700,650,true,true),
('fb0182','Baterías','Xiaomi','mi A3/Mi9Lite/CC9E','Batería','BM4FX4970','FB0182',550,500,500,true,true),
('fb0282','Baterías','Samsung','S21ULTRA','Batería','EB-BG998ABYS5500','FB0282',600,550,500,true,true),
('fb0032','Baterías','iPhone','XR','Batería','XRIP3500GRGF','FB0032',700,650,600,true,true),
('fb0270','Baterías','Samsung','A33/Ss A53 5G','Batería','EB-BA336ABYS5500','FB0270',600,550,500,true,true),
('fb0006','Baterías','iPhone','6P','Batería','6PIP2915BRGF','FB0006',600,550,500,true,true),
('fb0037','Baterías','iPhone','XS','Batería','XSIP2658BRJX','FB0037',750,700,650,true,true),
('fb0561','Baterías','Xiaomi','RM note 12 4G','Batería','BN5MX5500GR','FB0561',600,550,500,true,true),
('fb0272','Baterías','Samsung','A546/A54 5G/A35 5G/A34 5G/A25','Batería','EB-BA546ABYS5500','FB0272',600,550,500,true,true),
('fb0556','Baterías','Xiaomi','RM 12 5G/RM 12R/RM note12R','Batería','BM5RX5500GR','FB0556',600,550,500,true,true),
('fb0722','Baterías','Samsung','A055F/A055M/A05','Batería','WT-S-N28S5500GR','FB0722',600,550,500,true,true),
('fb0018','Baterías','iPhone','11Pro','Batería','11PROIP3046BRSF','FB0018',900,800,750,true,true),
('fb0008','Baterías','iPhone','7G','Batería','7GIP1960BRGF','FB0008',550,500,450,true,true),
('fb0475','Baterías','Xiaomi','RM 12C（China）/Poco C55/RM 11A','Batería','BN5KX5500GR','FB0475',600,550,500,true,true),
('fb1269','Baterías','iPhone','17PROMAX','Batería','17PROMAXI4823BR','FB1269',1500,1400,1300,true,true),
('fb0039','Baterías','iPhone','11ProMax','Batería','11PROMAXIP4500GR','FB0039',1000,950,850,true,true),
('fb0009','Baterías','iPhone','7P','Batería','7PIP2900BRGF','FB0009',600,550,500,true,true),
('fb1147','Baterías','iPhone','16','Batería','16I3561BR','FB1147',900,850,800,true,true),
('fb0873','Baterías','iPhone','16PRO','Batería','16PROI3582BR','FB0873',1100,1050,950,true,true),
('fb0280','Baterías','Samsung','S22 ULTRA','Batería','EB-BS908ABYS5400','FB0280',600,550,500,true,true),
('fb0134','Baterías','Samsung','A31/ A225/A315/A325/A22/A31S/A32/A325/F22 4G','Batería','EB-BA315ABYS5500','FB0134',550,550,500,true,true),
('fb0059','Baterías','Samsung','A20/A30/A50/A30S/A307/A50S/A507/M10S/M107','Batería','EB-BA505ABNS4400','FB0059',550,500,450,true,true),
('fb0019','Baterías','iPhone','11ProMax','Batería','11PROMAXIP3969BR','FB0019',950,900,800,true,true),
('fb0269','Baterías','Samsung','A536/A33 5G','Batería','BE-BA536ABYS5500','FB0269',600,550,500,true,true),
('fb0607','Baterías','Samsung','S24','Batería','EB-BS922ABYS4400GR','FB0607',600,550,500,true,true),
('fb0013','Baterías','iPhone','X','Batería','XIP2716BRGF','FB0013',700,650,600,true,true),
('fb0879','Baterías','Xiaomi','RM 12C（Global）/22120RN86G','Batería','BN5LRM5500GR','FB0879',600,550,500,true,true),
('fb0874','Baterías','iPhone','16PROMAX','Batería','16PROMAXI4685BR','FB0874',1150,1100,1000,true,true),
('fb0598','Baterías','Xiaomi','RM 13C/Poco C65/Poco M6 5G','Batería','BN5QRM5500GR','FB0598',600,550,500,true,true),
('fb0520','Baterías','Samsung','S22/S901','Batería','EB-BS901ABYS4070GR','FB0520',550,500,450,true,true),
('fb0604','Baterías','Xiaomi','Note 13 Pro 5G/Poco X6 5G','Batería','BM5VRM5610GR','FB0604',750,700,650,true,true),
('fb0597','Baterías','Xiaomi','RM A3/23129RN51X/RM A3X','Batería','BN5RX5500GR','FB0597',600,550,500,true,true),
('fb0012','Baterías','iPhone','SE 2020','Batería','SE2020IP1960BRGF','FB0012',550,500,450,true,true),
('fb0017','Baterías','iPhone','11','Batería','11IP3110BRGF','FB0017',700,650,600,true,true),
('fb1160','Baterías','Xiaomi','RM A5 4G','Batería','BP5EX5720GR','FB1160',600,550,500,true,true),
('fb0038','Baterías','iPhone','11Pro','Batería','11PROIP3480GR','FB0038',900,850,800,true,true),
('fb0060','Baterías','Samsung','A10/M10/A7 2018/M50/A105','Batería','EB-BA750ABUS3630','FB0060',500,500,450,true,true),
('fb0031','Baterías','iPhone','X','Batería','XIP3100GRGF','FB0031',750,700,650,true,true),
('fb0284','Baterías','Samsung','S21 PLUS','Batería','EB-BG996ABYS5280','FB0284',600,550,500,true,true),
('fb1268','Baterías','iPhone','17','Batería','17I3692BR','FB1268',1200,1100,1000,true,true)
on conflict do nothing;
