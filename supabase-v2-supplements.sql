-- ============================================================
-- Fitrack v2 — Supplements schema + library seed
-- ============================================================

-- 1. Bibliotheque globale
CREATE TABLE IF NOT EXISTS supplement_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  benefits TEXT[] NOT NULL DEFAULT '{}',
  recommended_moments TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Ajout colonnes sur supplements existant
ALTER TABLE supplements ADD COLUMN IF NOT EXISTS library_supplement_id UUID REFERENCES supplement_library(id) ON DELETE SET NULL;
ALTER TABLE supplements ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'custom';
ALTER TABLE supplements ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE supplements ADD COLUMN IF NOT EXISTS benefits TEXT[] NOT NULL DEFAULT '{}';

-- 3. Seed
INSERT INTO supplement_library (name, category, description, benefits, recommended_moments) VALUES

-- PROTEINES
('Whey Proteine', 'protein',
 'Proteine de lactoserum a assimilation rapide, issue du lait. Ideale post-effort pour la recuperation musculaire.',
 ARRAY['Favorise la synthese musculaire','Recuperation rapide','Rassasiant'],
 ARRAY['post_workout','petit_dejeuner']),

('Caseine', 'protein',
 'Proteine a digestion lente, libere les acides amines sur plusieurs heures. Parfaite avant de dormir.',
 ARRAY['Anti-catabolisme nocturne','Satiele prolongee','Preserve la masse musculaire'],
 ARRAY['avant_dormir']),

('Proteine Vegetale (Pea/Rice)', 'protein',
 'Alternative vegane a la whey. Melange de proteines de pois et de riz pour un profil complet en acides amines.',
 ARRAY['Convient aux vegans','Bonne digestibilite','Soutien musculaire'],
 ARRAY['post_workout','petit_dejeuner']),

-- ACIDES AMINES
('Creatine Monohydrate', 'amino',
 'Acide amine stocke dans les muscles, augmente la force et la puissance lors des efforts courts et intenses.',
 ARRAY['Augmente la force','Ameliore la puissance explosive','Favorise la prise de masse'],
 ARRAY['pre_workout','post_workout','petit_dejeuner']),

('BCAA (2:1:1)', 'amino',
 'Leucine, Isoleucine, Valine — les 3 acides amines branches essentiels. Limitent le catabolisme musculaire.',
 ARRAY['Anti-catabolisme','Reduction de la fatigue musculaire','Soutien de la recuperation'],
 ARRAY['pre_workout','post_workout']),

('L-Glutamine', 'amino',
 'Acide amine le plus abondant dans le muscle. Soutient la recuperation et l''immunite apres les efforts intenses.',
 ARRAY['Recuperation musculaire','Soutien immunitaire','Sante intestinale'],
 ARRAY['post_workout','avant_dormir']),

('L-Arginine', 'amino',
 'Precurseur de l''oxyde nitrique, favorise la vasodilatation et le flux sanguin vers les muscles.',
 ARRAY['Ameliore la vascularisation','Pompe musculaire','Soutient la performance'],
 ARRAY['pre_workout']),

('L-Citrulline', 'amino',
 'Plus efficace que l''arginine pour augmenter le NO. Retarde la fatigue musculaire.',
 ARRAY['Endurance musculaire','Pompe','Reduction des courbatures'],
 ARRAY['pre_workout']),

('Taurine', 'amino',
 'Acide amine aux proprietes antioxydantes. Reduit les dommages musculaires et la fatigue mentale.',
 ARRAY['Antioxydant','Reduction de la fatigue','Hydratation cellulaire'],
 ARRAY['pre_workout','petit_dejeuner']),

('Beta-Alanine', 'amino',
 'Precurseur de la carnosine, tamponne l''acide lactique dans les muscles. Ameliore l''endurance.',
 ARRAY['Retarde la fatigue','Endurance','Performance sur les series longues'],
 ARRAY['pre_workout']),

('EAA (Acides Amines Essentiels)', 'amino',
 'Les 9 acides amines essentiels que le corps ne peut pas synthetiser. Plus complet que les BCAA.',
 ARRAY['Synthese proteique complete','Recuperation','Anti-catabolisme'],
 ARRAY['pre_workout','post_workout']),

-- VITAMINES
('Vitamine D3', 'vitamin',
 'Essentielle a la sante osseuse, immunitaire et hormonale. La majorite de la population en manque, surtout en hiver.',
 ARRAY['Sante osseuse','Immunite','Regulation hormonale','Energie'],
 ARRAY['petit_dejeuner']),

('Vitamine C', 'vitamin',
 'Antioxydant puissant, soutient l''immunite et la production de collagene.',
 ARRAY['Immunite','Antioxydant','Synthese du collagene','Absorption du fer'],
 ARRAY['petit_dejeuner','dejeuner']),

('Vitamine B12', 'vitamin',
 'Indispensable a la production d''energie et au bon fonctionnement nerveux. Souvent deficitaire chez les vegans.',
 ARRAY['Energie','Fonctionnement neurologique','Hematopoiese'],
 ARRAY['petit_dejeuner']),

('Vitamine K2 (MK-7)', 'vitamin',
 'Favorise la fixation du calcium dans les os et previent les depots arteriels. Souvent associee a la D3.',
 ARRAY['Sante osseuse','Sante cardiovasculaire','Absorption du calcium'],
 ARRAY['petit_dejeuner']),

('Complexe Vitamine B', 'vitamin',
 'Ensemble des vitamines B (B1, B2, B3, B5, B6, B8, B9, B12). Essentielles au metabolisme energetique.',
 ARRAY['Metabolisme energetique','Anti-fatigue','Fonctionnement nerveux'],
 ARRAY['petit_dejeuner']),

('Vitamine E', 'vitamin',
 'Antioxydant liposoluble qui protege les cellules du stress oxydatif.',
 ARRAY['Antioxydant','Protection cellulaire','Peau et cheveux'],
 ARRAY['dejeuner','diner']),

-- MINERAUX
('Magnesium Bisglycinate', 'mineral',
 'Forme de magnesium a haute biodisponibilite. Reduit le stress, ameliore le sommeil et la recuperation musculaire.',
 ARRAY['Reduction du stress','Qualite du sommeil','Recuperation musculaire','Crampes'],
 ARRAY['diner','avant_dormir']),

('Zinc', 'mineral',
 'Mineral cle pour la testosterone, l''immunite et la cicatrisation. Souvent deficitaire chez les sportifs.',
 ARRAY['Testosterone','Immunite','Cicatrisation','Antioxydant'],
 ARRAY['avant_dormir']),

('ZMA (Zinc + Magnesium + B6)', 'mineral',
 'Formule combinant zinc, magnesium et vitamine B6 pour optimiser la recuperation nocturne et les hormones.',
 ARRAY['Recuperation nocturne','Testosterone','Qualite du sommeil'],
 ARRAY['avant_dormir']),

('Fer', 'mineral',
 'Composant central de l''hemoglobine. Une carence entraine fatigue et baisse des performances.',
 ARRAY['Transport de l''oxygene','Anti-fatigue','Performance aerobie'],
 ARRAY['petit_dejeuner']),

('Calcium', 'mineral',
 'Indispensable a la solidite osseuse et a la contraction musculaire.',
 ARRAY['Sante osseuse','Contraction musculaire','Dents'],
 ARRAY['petit_dejeuner','diner']),

('Potassium', 'mineral',
 'Electrolyte essentiel a l''equilibre hydrique et a la fonction musculaire.',
 ARRAY['Equilibre electrolytique','Prevention des crampes','Pression arterielle'],
 ARRAY['post_workout','diner']),

('Iode', 'mineral',
 'Necessaire a la synthese des hormones thyroidiennes qui regulent le metabolisme.',
 ARRAY['Metabolisme','Thyroide','Energie'],
 ARRAY['petit_dejeuner']),

-- BOOSTERS
('Cafeine', 'booster',
 'Stimulant du systeme nerveux central. Ameliore la vigilance, la concentration et la performance sportive.',
 ARRAY['Energie','Concentration','Performance','Bruleur de graisses'],
 ARRAY['pre_workout','petit_dejeuner']),

('Pre-Workout (complexe)', 'booster',
 'Formule multi-ingredients combinant stimulants, vasodilatateurs et acides amines pour maximiser la performance.',
 ARRAY['Energie explosive','Pompe musculaire','Endurance','Focus'],
 ARRAY['pre_workout']),

('Ashwagandha (KSM-66)', 'booster',
 'Adaptogene qui reduit le cortisol (hormone du stress), ameliore la recuperation et soutient la testosterone.',
 ARRAY['Reduction du stress','Taux de testosterone','Recuperation','Sommeil'],
 ARRAY['diner','avant_dormir']),

('Rhodiola Rosea', 'booster',
 'Plante adaptogene qui ameliore la resistance a la fatigue physique et mentale.',
 ARRAY['Anti-fatigue','Endurance mentale','Gestion du stress'],
 ARRAY['petit_dejeuner','pre_workout']),

('Tribulus Terrestris', 'booster',
 'Plante utilisee pour soutenir la libido et les niveaux de testosterone.',
 ARRAY['Libido','Testosterone','Energie'],
 ARRAY['petit_dejeuner']),

-- RECUPERATION
('Omega-3 (EPA/DHA)', 'recovery',
 'Acides gras essentiels a la protection cardiovasculaire et a la reduction de l''inflammation.',
 ARRAY['Anti-inflammatoire','Sante cardiovasculaire','Recuperation','Cerveau'],
 ARRAY['petit_dejeuner','diner']),

('Collagene Hydrolyse', 'recovery',
 'Proteine structurelle qui soutient les articulations, tendons, peau et os.',
 ARRAY['Articulations','Tendons','Peau','Prevention des blessures'],
 ARRAY['petit_dejeuner','post_workout']),

('Curcumine (Curcuma)', 'recovery',
 'Puissant anti-inflammatoire naturel, ameliore la recuperation post-entrainement.',
 ARRAY['Anti-inflammatoire','Recuperation','Antioxydant','Articulations'],
 ARRAY['diner','avant_dormir']),

('Glucosamine + Chondroitine', 'recovery',
 'Duo pour la sante des cartilages articulaires et la prevention de leur degradation.',
 ARRAY['Cartilage','Articulations','Mobilite','Prevention des blessures'],
 ARRAY['petit_dejeuner','diner']),

('HMB', 'recovery',
 'Metabolite de la leucine, puissant anti-catabolique. Utile lors des phases de seche ou de recuperation.',
 ARRAY['Anti-catabolisme','Preservation musculaire','Recuperation'],
 ARRAY['post_workout','avant_dormir']),

('Electrolytes', 'recovery',
 'Melange de sodium, potassium, magnesium et chlorure pour la rehydratation apres l''effort.',
 ARRAY['Rehydratation','Prevention des crampes','Endurance'],
 ARRAY['post_workout','pre_workout']),

('Spiruline', 'recovery',
 'Super-aliment riche en proteines, fer, antioxydants et vitamines B. Soutient l''immunite et l''energie.',
 ARRAY['Energie','Immunite','Antioxydant','Fer'],
 ARRAY['petit_dejeuner','collation_matin']),

-- SANTE GENERALE
('Probiotiques', 'health',
 'Bacteries benefiques qui renforcent le microbiote intestinal et l''immunite.',
 ARRAY['Microbiote','Immunite','Digestion','Absorption des nutriments'],
 ARRAY['petit_dejeuner','avant_dormir']),

('Vitamine D3 + K2', 'health',
 'Association synergique pour la sante osseuse et cardiovasculaire. La K2 guide le calcium vers les os.',
 ARRAY['Sante osseuse','Cardiovasculaire','Immunite'],
 ARRAY['petit_dejeuner']),

('Huile de poisson', 'health',
 'Source naturelle d''omega-3 EPA et DHA. Soutient le cerveau, le coeur et la reduction de l''inflammation.',
 ARRAY['Cerveau','Coeur','Anti-inflammatoire'],
 ARRAY['petit_dejeuner','diner']),

('Charbon Actif', 'health',
 'Aide a eliminer les toxines et les gaz digestifs. A utiliser ponctuellement.',
 ARRAY['Detox','Ballonnements','Digestion'],
 ARRAY['collation']),

('Melatonine', 'health',
 'Hormone du sommeil. Aide a s''endormir plus vite et a reguler le cycle circadien.',
 ARRAY['Endormissement','Qualite du sommeil','Recuperation'],
 ARRAY['avant_dormir']),

('5-HTP', 'health',
 'Precurseur de la serotonine et de la melatonine. Ameliore l''humeur et le sommeil.',
 ARRAY['Humeur','Sommeil','Anxiete'],
 ARRAY['diner','avant_dormir']),

('Resveratrol', 'health',
 'Antioxydant puissant present dans le raisin. Soutient la longevite cellulaire et la sante cardiovasculaire.',
 ARRAY['Antioxydant','Cardiovasculaire','Anti-age'],
 ARRAY['diner']),

('NAC (N-Acetyl Cysteine)', 'health',
 'Precurseur du glutathion, le principal antioxydant de l''organisme. Soutient le foie et l''immunite.',
 ARRAY['Antioxydant','Foie','Immunite','Detox'],
 ARRAY['petit_dejeuner','avant_dormir']),

('Ginseng', 'health',
 'Adaptogene classique qui ameliore l''energie, la cognition et la resistance au stress.',
 ARRAY['Energie','Concentration','Adaptogene','Immunite'],
 ARRAY['petit_dejeuner']);
