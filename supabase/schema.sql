-- ============================================================
-- OVERMIND — KING'S BBQ INVENTORY SCHEMA
-- Paste this entire file into Supabase SQL Editor and Run
-- ============================================================

-- TABLES

CREATE TABLE IF NOT EXISTS vendors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  order_frequency TEXT NOT NULL CHECK (order_frequency IN ('weekly', 'twice_weekly')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id),
  unit TEXT NOT NULL DEFAULT 'case',
  par_level NUMERIC,
  par_auto BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_vendors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  price NUMERIC(10,2),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, vendor_id)
);

CREATE TABLE IF NOT EXISTS inventory_counts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity_on_hand NUMERIC NOT NULL,
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  order_slot INTEGER CHECK (order_slot IN (1, 2)),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID REFERENCES vendors(id),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  order_slot INTEGER CHECK (order_slot IN (1, 2)),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'received')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity_ordered NUMERIC NOT NULL,
  unit_price NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  order_slot INTEGER CHECK (order_slot IN (1, 2)),
  usage_amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- VENDORS
INSERT INTO vendors (name, order_frequency) VALUES
  ('Martin''s Bakery',    'twice_weekly'),
  ('PFG',                 'weekly'),
  ('Restaurant Depot',    'weekly'),
  ('Sam''s Club',         'weekly'),
  ('Shuler Meats',        'twice_weekly'),
  ('Skeens Eggs',         'twice_weekly'),
  ('Super Source',        'weekly'),
  ('Walmart',             'twice_weekly')
ON CONFLICT (name) DO NOTHING;

-- CATEGORIES
INSERT INTO categories (name) VALUES
  ('Proteins & Meat'),
  ('Dairy & Eggs'),
  ('Produce'),
  ('Bread & Bakery'),
  ('Beverages'),
  ('Condiments & Sauces'),
  ('Dry Goods & Pantry'),
  ('Frozen'),
  ('Cooking Supplies'),
  ('Paper & Packaging'),
  ('Cleaning & Janitorial')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- PRODUCTS — inserted via category/vendor name lookup
-- ============================================================

-- PROTEINS & MEAT
WITH cat AS (SELECT id FROM categories WHERE name = 'Proteins & Meat'),
     v1  AS (SELECT id FROM vendors WHERE name = 'PFG'),
     v2  AS (SELECT id FROM vendors WHERE name = 'Shuler Meats')
INSERT INTO products (name, category_id, unit) VALUES
  ('Pork Tenderloin',     (SELECT id FROM cat), 'lbs'),
  ('Sausage Patties',     (SELECT id FROM cat), 'case'),
  ('Chicken Wings',       (SELECT id FROM cat), 'lbs'),
  ('Hamburger',           (SELECT id FROM cat), 'lbs'),
  ('Bacon',               (SELECT id FROM cat), 'lbs'),
  ('Bologna',             (SELECT id FROM cat), 'lbs'),
  ('Pork Shoulders',      (SELECT id FROM cat), 'lbs'),
  ('Hotdogs',             (SELECT id FROM cat), 'case'),
  ('6 oz Chicken Breast', (SELECT id FROM cat), 'lbs'),
  ('Country Ham',         (SELECT id FROM cat), 'lbs');

-- DAIRY & EGGS
WITH cat AS (SELECT id FROM categories WHERE name = 'Dairy & Eggs')
INSERT INTO products (name, category_id, unit) VALUES
  ('Solid Margarine',      (SELECT id FROM cat), 'case'),
  ('Buttermilk',           (SELECT id FROM cat), 'case'),
  ('Sour Cream',           (SELECT id FROM cat), 'case'),
  ('Cheddar Cheese Slices',(SELECT id FROM cat), 'case'),
  ('American Sliced Cheese',(SELECT id FROM cat),'case'),
  ('Cream Cheese',         (SELECT id FROM cat), 'case'),
  ('Liquid Margarine',     (SELECT id FROM cat), 'case'),
  ('Margarine Packs',      (SELECT id FROM cat), 'case'),
  ('Shredded Cheese Blend',(SELECT id FROM cat), 'case'),
  ('Cool Whip',            (SELECT id FROM cat), 'case'),
  ('Eggs',                 (SELECT id FROM cat), 'case'),
  ('Milk',                 (SELECT id FROM cat), 'case');

-- PRODUCE
WITH cat AS (SELECT id FROM categories WHERE name = 'Produce')
INSERT INTO products (name, category_id, unit) VALUES
  ('Yellow Onions',    (SELECT id FROM cat), 'lbs'),
  ('Cucumbers',        (SELECT id FROM cat), 'case'),
  ('Green Bell Peppers',(SELECT id FROM cat),'lbs'),
  ('Shredded Carrots', (SELECT id FROM cat), 'case'),
  ('Iceberg Lettuce',  (SELECT id FROM cat), 'case'),
  ('Red Onions',       (SELECT id FROM cat), 'lbs'),
  ('Potatoes',         (SELECT id FROM cat), 'lbs'),
  ('Green Beans',      (SELECT id FROM cat), 'case'),
  ('Cabbage',          (SELECT id FROM cat), 'each'),
  ('Tomatoes',         (SELECT id FROM cat), 'lbs'),
  ('Strawberries',     (SELECT id FROM cat), 'lbs'),
  ('Peaches',          (SELECT id FROM cat), 'lbs');

-- BREAD & BAKERY
WITH cat AS (SELECT id FROM categories WHERE name = 'Bread & Bakery')
INSERT INTO products (name, category_id, unit) VALUES
  ('Hamburger Buns',    (SELECT id FROM cat), 'case'),
  ('Hotdog Buns',       (SELECT id FROM cat), 'case'),
  ('Loaf Bread',        (SELECT id FROM cat), 'case'),
  ('Honey Wheat Bread', (SELECT id FROM cat), 'case'),
  ('Tortillas',         (SELECT id FROM cat), 'case'),
  ('Nilla Wafers',      (SELECT id FROM cat), 'case'),
  ('Self Rising Flour', (SELECT id FROM cat), 'lbs'),
  ('Hush Puppy Mix',    (SELECT id FROM cat), 'case'),
  ('Club Crackers',     (SELECT id FROM cat), 'case'),
  ('Pancake Mix',       (SELECT id FROM cat), 'case');

-- BEVERAGES
WITH cat AS (SELECT id FROM categories WHERE name = 'Beverages')
INSERT INTO products (name, category_id, unit) VALUES
  ('Coca-Cola',      (SELECT id FROM cat), 'case'),
  ('Diet Coke',      (SELECT id FROM cat), 'case'),
  ('Coke Zero',      (SELECT id FROM cat), 'case'),
  ('Dr Pepper',      (SELECT id FROM cat), 'case'),
  ('Sprite',         (SELECT id FROM cat), 'case'),
  ('Mello Yello',    (SELECT id FROM cat), 'case'),
  ('Cheerwine',      (SELECT id FROM cat), 'case'),
  ('Pink Lemonade',  (SELECT id FROM cat), 'case'),
  ('Regular Coffee', (SELECT id FROM cat), 'case'),
  ('Decaf Coffee',   (SELECT id FROM cat), 'case'),
  ('Tea Bags',       (SELECT id FROM cat), 'case'),
  ('Apple Juice',    (SELECT id FROM cat), 'case'),
  ('Orange Juice',   (SELECT id FROM cat), 'case');

-- CONDIMENTS & SAUCES
WITH cat AS (SELECT id FROM categories WHERE name = 'Condiments & Sauces')
INSERT INTO products (name, category_id, unit) VALUES
  ('Pickled Jalapeño',       (SELECT id FROM cat), 'case'),
  ('Kosher Pickle Slices',   (SELECT id FROM cat), 'case'),
  ('Mustard (Gallon)',        (SELECT id FROM cat), 'each'),
  ('Mayo (Gallon)',           (SELECT id FROM cat), 'each'),
  ('Apple Cider Vinegar',     (SELECT id FROM cat), 'case'),
  ('Thousand Island Dressing',(SELECT id FROM cat), 'case'),
  ('Grape Jelly',             (SELECT id FROM cat), 'case'),
  ('Strawberry Jelly',        (SELECT id FROM cat), 'case'),
  ('Nacho Cheese Sauce',      (SELECT id FROM cat), 'case'),
  ('Ketchup Cans',            (SELECT id FROM cat), 'case'),
  ('BBQ Sauce',               (SELECT id FROM cat), 'case'),
  ('Pickle Juice',            (SELECT id FROM cat), 'case'),
  ('Ranch Mix',               (SELECT id FROM cat), 'case'),
  ('Ketchup Packets',         (SELECT id FROM cat), 'case'),
  ('Mustard Packets',         (SELECT id FROM cat), 'case'),
  ('Mayo Packets',            (SELECT id FROM cat), 'case'),
  ('Texas Pete Packets',      (SELECT id FROM cat), 'case'),
  ('Lemon Juice Packets',     (SELECT id FROM cat), 'case');

-- DRY GOODS & PANTRY
WITH cat AS (SELECT id FROM categories WHERE name = 'Dry Goods & Pantry')
INSERT INTO products (name, category_id, unit) VALUES
  ('Powdered Sugar',    (SELECT id FROM cat), 'lbs'),
  ('Vanilla Extract',   (SELECT id FROM cat), 'case'),
  ('Corn Starch',       (SELECT id FROM cat), 'lbs'),
  ('Panko',             (SELECT id FROM cat), 'case'),
  ('Baked Beans',       (SELECT id FROM cat), 'case'),
  ('Banana Pudding',    (SELECT id FROM cat), 'case'),
  ('Paprika',           (SELECT id FROM cat), 'lbs'),
  ('Chili Powder',      (SELECT id FROM cat), 'lbs'),
  ('Crushed Red Pepper',(SELECT id FROM cat), 'lbs'),
  ('Garlic Powder',     (SELECT id FROM cat), 'lbs'),
  ('Onion Powder',      (SELECT id FROM cat), 'lbs'),
  ('Black Pepper',      (SELECT id FROM cat), 'lbs'),
  ('Lemon Pepper',      (SELECT id FROM cat), 'lbs'),
  ('Mac n Cheese',      (SELECT id FROM cat), 'case'),
  ('Peppered Gravy Mix',(SELECT id FROM cat), 'case'),
  ('Ground Red Pepper', (SELECT id FROM cat), 'lbs'),
  ('Grits',             (SELECT id FROM cat), 'lbs'),
  ('Iodized Salt',      (SELECT id FROM cat), 'case'),
  ('Sugar Bales',       (SELECT id FROM cat), 'case'),
  ('Wood Chips',        (SELECT id FROM cat), 'case');

-- FROZEN
WITH cat AS (SELECT id FROM categories WHERE name = 'Frozen')
INSERT INTO products (name, category_id, unit) VALUES
  ('French Fries',    (SELECT id FROM cat), 'case'),
  ('Tater Tots',      (SELECT id FROM cat), 'case'),
  ('Chicken Nuggets', (SELECT id FROM cat), 'case');

-- COOKING SUPPLIES
WITH cat AS (SELECT id FROM categories WHERE name = 'Cooking Supplies')
INSERT INTO products (name, category_id, unit) VALUES
  ('Fry Oil',        (SELECT id FROM cat), 'case'),
  ('PAM Cook Spray', (SELECT id FROM cat), 'case'),
  ('Aluminum Foil',  (SELECT id FROM cat), 'case'),
  ('Saran Wrap',     (SELECT id FROM cat), 'case'),
  ('Grease Filters', (SELECT id FROM cat), 'case'),
  ('Full Size Pans', (SELECT id FROM cat), 'case'),
  ('Full Size Lids', (SELECT id FROM cat), 'case'),
  ('Half Size Pans', (SELECT id FROM cat), 'case'),
  ('Half Size Lids', (SELECT id FROM cat), 'case');

-- PAPER & PACKAGING
WITH cat AS (SELECT id FROM categories WHERE name = 'Paper & Packaging')
INSERT INTO products (name, category_id, unit) VALUES
  ('Salt Packets',                     (SELECT id FROM cat), 'case'),
  ('Pepper Packets',                   (SELECT id FROM cat), 'case'),
  ('Drink Carriers',                   (SELECT id FROM cat), 'case'),
  ('Single Compartment Plates',        (SELECT id FROM cat), 'case'),
  ('3 Compartment Plates',             (SELECT id FROM cat), 'case'),
  ('6x9 Single Compartment To-Go Box', (SELECT id FROM cat), 'case'),
  ('9x9 Single Compartment To-Go Box', (SELECT id FROM cat), 'case'),
  ('9x9 3 Compartment To-Go Box',      (SELECT id FROM cat), 'case'),
  ('#50 Checkered Tray',               (SELECT id FROM cat), 'case'),
  ('#25 Checkered Tray',               (SELECT id FROM cat), 'case'),
  ('Cocktail Straws',                  (SELECT id FROM cat), 'case'),
  ('Sweet N Low',                      (SELECT id FROM cat), 'case'),
  ('Splenda',                          (SELECT id FROM cat), 'case'),
  ('Sugar Packets',                    (SELECT id FROM cat), 'case'),
  ('55 Gallon Can Liner',              (SELECT id FROM cat), 'case'),
  ('LG FF Bags',                       (SELECT id FROM cat), 'case'),
  ('Thank You Bags',                   (SELECT id FROM cat), 'case'),
  ('Plastic Knives',                   (SELECT id FROM cat), 'case'),
  ('Plastic Spoons',                   (SELECT id FROM cat), 'case'),
  ('Plastic Forks',                    (SELECT id FROM cat), 'case'),
  ('Logan Wax Paper',                  (SELECT id FROM cat), 'case'),
  ('4 lb Bags',                        (SELECT id FROM cat), 'case'),
  ('10 lb Bags',                       (SELECT id FROM cat), 'case'),
  ('16 lb Bags',                       (SELECT id FROM cat), 'case'),
  ('1 oz Portion Cups',                (SELECT id FROM cat), 'case'),
  ('1 oz Portion Cup Lids',            (SELECT id FROM cat), 'case'),
  ('2 oz Portion Cups',                (SELECT id FROM cat), 'case'),
  ('2 oz Portion Cup Lids',            (SELECT id FROM cat), 'case'),
  ('6 oz Squat Cups',                  (SELECT id FROM cat), 'case'),
  ('6 oz Squat Cup Lids',              (SELECT id FROM cat), 'case'),
  ('12 oz Squat Cups',                 (SELECT id FROM cat), 'case'),
  ('12 oz Squat Lids',                 (SELECT id FROM cat), 'case'),
  ('16 oz Deli Container',             (SELECT id FROM cat), 'case'),
  ('32 oz Deli Container',             (SELECT id FROM cat), 'case'),
  ('Deli Container Lids',              (SELECT id FROM cat), 'case'),
  ('Half Gallon Jugs',                 (SELECT id FROM cat), 'case'),
  ('Gallon Jugs',                      (SELECT id FROM cat), 'case'),
  ('Straws',                           (SELECT id FROM cat), 'case'),
  ('Napkins',                          (SELECT id FROM cat), 'case'),
  ('20 oz Drink Cups',                 (SELECT id FROM cat), 'case'),
  ('20 oz Drink Lids',                 (SELECT id FROM cat), 'case');

-- CLEANING & JANITORIAL
WITH cat AS (SELECT id FROM categories WHERE name = 'Cleaning & Janitorial')
INSERT INTO products (name, category_id, unit) VALUES
  ('Metal Scour Pads',         (SELECT id FROM cat), 'case'),
  ('Brillo Pads',              (SELECT id FROM cat), 'case'),
  ('Mop Heads',                (SELECT id FROM cat), 'each'),
  ('Mop Handles',              (SELECT id FROM cat), 'each'),
  ('Brooms',                   (SELECT id FROM cat), 'each'),
  ('Oven & Grill Cleaner',     (SELECT id FROM cat), 'case'),
  ('Grill Bricks',             (SELECT id FROM cat), 'case'),
  ('Spray Bottles',            (SELECT id FROM cat), 'each'),
  ('Hand Soap',                (SELECT id FROM cat), 'case'),
  ('Microbial Degreaser',      (SELECT id FROM cat), 'case'),
  ('Jug Lids',                 (SELECT id FROM cat), 'case'),
  ('Toilet Paper',             (SELECT id FROM cat), 'case'),
  ('Paper Towels',             (SELECT id FROM cat), 'case'),
  ('Urinal Pads',              (SELECT id FROM cat), 'case'),
  ('Sanitizer',                (SELECT id FROM cat), 'case'),
  ('Dish Detergent',           (SELECT id FROM cat), 'case'),
  ('Black Nitrile Gloves Med', (SELECT id FROM cat), 'case'),
  ('Black Nitrile Gloves Large',(SELECT id FROM cat),'case'),
  ('Black Nitrile Gloves XLarge',(SELECT id FROM cat),'case');

-- ============================================================
-- PRODUCT-VENDOR RELATIONSHIPS
-- (prices start NULL — enter via the dashboard)
-- ============================================================

-- Martin's Bakery products
INSERT INTO product_vendors (product_id, vendor_id)
SELECT p.id, v.id FROM products p, vendors v
WHERE v.name = 'Martin''s Bakery'
  AND p.name IN ('Hamburger Buns','Hotdog Buns','Loaf Bread')
ON CONFLICT (product_id, vendor_id) DO NOTHING;

-- PFG products
INSERT INTO product_vendors (product_id, vendor_id)
SELECT p.id, v.id FROM products p, vendors v
WHERE v.name = 'PFG'
  AND p.name IN (
    'Pork Tenderloin','Solid Margarine','Buttermilk','Sour Cream',
    'Cheddar Cheese Slices','Pickled Jalapeño','Kosher Pickle Slices',
    'Yellow Onions','Cucumbers','Green Bell Peppers','Shredded Carrots',
    'Iceberg Lettuce','Red Onions','Tortillas','American Sliced Cheese',
    'Coca-Cola','Diet Coke','Coke Zero','Dr Pepper','Sprite','Mello Yello',
    'Cheerwine','Pink Lemonade','Powdered Sugar','Mustard (Gallon)',
    'Honey Wheat Bread','Sausage Patties','Chicken Nuggets','Regular Coffee',
    'Decaf Coffee','Cream Cheese','Potatoes','Apple Cider Vinegar','Mayo (Gallon)'
  )
ON CONFLICT (product_id, vendor_id) DO NOTHING;

-- Restaurant Depot products
INSERT INTO product_vendors (product_id, vendor_id)
SELECT p.id, v.id FROM products p, vendors v
WHERE v.name = 'Restaurant Depot'
  AND p.name IN (
    'Thousand Island Dressing','Vanilla Extract','Fry Oil','Corn Starch','Panko',
    'Grape Jelly','Strawberry Jelly','Salt Packets','Pepper Packets','Lemon Pepper',
    'Drink Carriers','Single Compartment Plates','3 Compartment Plates',
    '6x9 Single Compartment To-Go Box','9x9 Single Compartment To-Go Box',
    '9x9 3 Compartment To-Go Box','#50 Checkered Tray','#25 Checkered Tray',
    'Cocktail Straws','Green Beans','Nacho Cheese Sauce','Banana Pudding',
    'Ketchup Cans','Baked Beans','Paprika','Chili Powder','Crushed Red Pepper',
    'Garlic Powder','Onion Powder','Black Pepper','BBQ Sauce',
    'Sweet N Low','Splenda','Sugar Packets'
  )
ON CONFLICT (product_id, vendor_id) DO NOTHING;

-- Sam's Club products
INSERT INTO product_vendors (product_id, vendor_id)
SELECT p.id, v.id FROM products p, vendors v
WHERE v.name = 'Sam''s Club'
  AND p.name IN ('French Fries','20 oz Drink Cups','20 oz Drink Lids')
ON CONFLICT (product_id, vendor_id) DO NOTHING;

-- Shuler Meats products
INSERT INTO product_vendors (product_id, vendor_id)
SELECT p.id, v.id FROM products p, vendors v
WHERE v.name = 'Shuler Meats'
  AND p.name IN (
    'Chicken Wings','Hamburger','Bacon','Bologna','Pork Shoulders','Hotdogs',
    'Pickle Juice','Liquid Margarine','Mac n Cheese','Margarine Packs',
    'Shredded Cheese Blend','6 oz Chicken Breast','Nilla Wafers',
    'Self Rising Flour','Peppered Gravy Mix','Ground Red Pepper','Grits',
    'PAM Cook Spray','Iodized Salt','Sugar Bales','Ranch Mix',
    'Aluminum Foil','Saran Wrap','Hush Puppy Mix','55 Gallon Can Liner',
    'Cool Whip','Tea Bags','Club Crackers','Ketchup Packets','Plastic Knives',
    'Plastic Spoons','Plastic Forks','Mustard Packets','Mayo Packets',
    'Texas Pete Packets','Lemon Juice Packets','Grease Filters',
    'Full Size Pans','Full Size Lids','Half Size Pans','Half Size Lids',
    'LG FF Bags','Thank You Bags','Country Ham'
  )
ON CONFLICT (product_id, vendor_id) DO NOTHING;

-- Skeens Eggs products
INSERT INTO product_vendors (product_id, vendor_id)
SELECT p.id, v.id FROM products p, vendors v
WHERE v.name = 'Skeens Eggs'
  AND p.name IN ('Eggs','Tater Tots','Cabbage','Tomatoes')
ON CONFLICT (product_id, vendor_id) DO NOTHING;

-- Super Source products
INSERT INTO product_vendors (product_id, vendor_id)
SELECT p.id, v.id FROM products p, vendors v
WHERE v.name = 'Super Source'
  AND p.name IN (
    'Metal Scour Pads','Brillo Pads','Mop Heads','Mop Handles','Brooms',
    'Oven & Grill Cleaner','Grill Bricks','Spray Bottles','Hand Soap',
    'Microbial Degreaser','Jug Lids','Toilet Paper','Paper Towels','Urinal Pads',
    'Black Nitrile Gloves Med','Black Nitrile Gloves Large','Black Nitrile Gloves XLarge',
    'Logan Wax Paper','4 lb Bags','10 lb Bags','16 lb Bags',
    '1 oz Portion Cups','1 oz Portion Cup Lids','2 oz Portion Cups','2 oz Portion Cup Lids',
    '6 oz Squat Cups','6 oz Squat Cup Lids','12 oz Squat Cups','12 oz Squat Lids',
    '16 oz Deli Container','32 oz Deli Container','Deli Container Lids',
    'Half Gallon Jugs','Gallon Jugs','Straws','Napkins','Sanitizer','Dish Detergent'
  )
ON CONFLICT (product_id, vendor_id) DO NOTHING;

-- Walmart products
INSERT INTO product_vendors (product_id, vendor_id)
SELECT p.id, v.id FROM products p, vendors v
WHERE v.name = 'Walmart'
  AND p.name IN ('Milk','Apple Juice','Orange Juice','Strawberries','Peaches','Pancake Mix','Wood Chips')
ON CONFLICT (product_id, vendor_id) DO NOTHING;
