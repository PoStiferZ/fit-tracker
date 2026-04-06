-- ============================================================
-- Fitrack v2 — Supplements schema + library seed
-- ============================================================

-- 1. Bibliothèque globale
CREATE TABLE IF NOT EXISTS supplement_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- protein|amino|vitamin|mineral|booster|recovery|health|hormone
  description TEXT NOT NULL DEFAULT '',
  benefits TEXT[] NOT NULL DEFAULT '{}',
  recommended_moments TEXT[] NOT NULL DEFAULT '{}', -- hints only, user chooses
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Compléments choisis par l'utilisateur (remplace supplements)
-- On garde la table supplements existante et on ajoute library_supplement_id
ALTER TABLE supplements ADD COLUMN IF NOT EXISTS library_supplement_id UUID REFERENCES supplement_library(id) ON DELETE SET NULL;
ALTER TABLE supplements ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'custom'; -- library|custom
ALTER TABLE supplements ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE supplements ADD COLUMN IF NOT EXISTS benefits TEXT[] NOT NULL DEFAULT '{}';

-- 3. Seed — bibliothèque de compléments (~45 refs)
INSERT INTO supplement_library (name, category, description, benefits, recommended_moments) VALUES

-- PROTÉINES
('Whey Protéine', 'protein',
 'Protéine de lactosérum à assimilation rapide, issue du lait. Idéale post-effort pour la récupération musculaire.',
 ARRAY['Favorise la synthèse musculaire','Récupération rapide','Rassasiant'],
 ARRAY['post_workout','petit_dejeuner']),

('Caséine', 'protein',
 'Protéine à digestion lente, libère les acides aminés sur plusieurs heures. Parfaite avant de dormir.',
 ARRAY['Anti-catabolisme nocturne','Satiété prolongée','Préserve la masse musculaire'],
 ARRAY['avant_dormir']),

('Protéine Végétale (Pea/Rice)', 'protein',
 'Alternative végane à la whey. Mélange de protéines de pois et de riz pour un profil d'acides aminés complet.',
 ARRAY['Convient aux végans','Bonne digestibilité','Soutien musculaire'],
 ARRAY['post_workout','petit_dejeuner']),

-- ACIDES AMINÉS
('Créatine Monohydrate', 'amino',
 'Acide aminé stocké dans les muscles, augmente la force et la puissance lors des efforts courts et intenses.',
 ARRAY['Augmente la force','Améliore la puissance explosive','Favorise la prise de masse'],
 ARRAY['pre_workout','post_workout','petit_dejeuner']),

('BCAA (2:1:1)', 'amino',
 'Leucine, Isoleucine, Valine — les 3 acides aminés branchés essentiels. Limitent le catabolisme musculaire.',
 ARRAY['Anti-catabolisme','Réduction de la fatigue musculaire','Soutien de la récupération'],
 ARRAY['pre_workout','post_workout']),

('L-Glutamine', 'amino',
 'Acide aminé le plus abondant dans le muscle. Soutient la récupération et l'immunité après les efforts intenses.',
 ARRAY['Récupération musculaire','Soutien immunitaire','Santé intestinale'],
 ARRAY['post_workout','avant_dormir']),

('L-Arginine', 'amino',
 'Précurseur de l'oxyde nitrique, favorise la vasodilatation et le flux sanguin vers les muscles.',
 ARRAY['Améliore la vascularisation','Pompe musculaire','Soutient la performance'],
 ARRAY['pre_workout']),

('L-Citrulline', 'amino',
 'Plus efficace que l'arginine pour augmenter le NO. Retarde la fatigue musculaire.',
 ARRAY['Endurance musculaire','Pompe','Réduction des courbatures'],
 ARRAY['pre_workout']),

('Taurine', 'amino',
 'Acide aminé aux propriétés antioxydantes. Réduit les dommages musculaires et la fatigue mentale.',
 ARRAY['Antioxydant','Réduction de la fatigue','Hydratation cellulaire'],
 ARRAY['pre_workout','petit_dejeuner']),

('Bêta-Alanine', 'amino',
 'Précurseur de la carnosine, tampon l'acide lactique dans les muscles. Améliore l'endurance.',
 ARRAY['Retarde la fatigue','Endurance','Performance sur les séries longues'],
 ARRAY['pre_workout']),

('EAA (Acides Aminés Essentiels)', 'amino',
 'Les 9 acides aminés essentiels que le corps ne peut pas synthétiser. Plus complet que les BCAA.',
 ARRAY['Synthèse protéique complète','Récupération','Anti-catabolisme'],
 ARRAY['pre_workout','post_workout']),

-- VITAMINES
('Vitamine D3', 'vitamin',
 'Essentielle à la santé osseuse, immunitaire et hormonale. La majorité de la population en manque (surtout en hiver).',
 ARRAY['Santé osseuse','Immunité','Régulation hormonale','Énergie'],
 ARRAY['petit_dejeuner']),

('Vitamine C', 'vitamin',
 'Antioxydant puissant, soutient l'immunité et la production de collagène.',
 ARRAY['Immunité','Antioxydant','Synthèse du collagène','Absorption du fer'],
 ARRAY['petit_dejeuner','dejeuner']),

('Vitamine B12', 'vitamin',
 'Indispensable à la production d'énergie et au bon fonctionnement nerveux. Souvent déficitaire chez les végans.',
 ARRAY['Énergie','Fonctionnement neurologique','Hématopoïèse'],
 ARRAY['petit_dejeuner']),

('Vitamine K2 (MK-7)', 'vitamin',
 'Favorise la fixation du calcium dans les os et prévient les dépôts artériels. Souvent associée à la D3.',
 ARRAY['Santé osseuse','Santé cardiovasculaire','Absorption du calcium'],
 ARRAY['petit_dejeuner']),

('Complexe Vitamine B', 'vitamin',
 'Ensemble des vitamines B (B1, B2, B3, B5, B6, B8, B9, B12). Essentielles au métabolisme énergétique.',
 ARRAY['Métabolisme énergétique','Anti-fatigue','Fonctionnement nerveux'],
 ARRAY['petit_dejeuner']),

('Vitamine E', 'vitamin',
 'Antioxydant liposoluble qui protège les cellules du stress oxydatif.',
 ARRAY['Antioxydant','Protection cellulaire','Peau et cheveux'],
 ARRAY['dejeuner','diner']),

-- MINÉRAUX
('Magnésium Bisglycinate', 'mineral',
 'Forme de magnésium à haute biodisponibilité. Réduit le stress, améliore le sommeil et la récupération musculaire.',
 ARRAY['Réduction du stress','Qualité du sommeil','Récupération musculaire','Crampes'],
 ARRAY['diner','avant_dormir']),

('Zinc', 'mineral',
 'Minéral clé pour la testostérone, l'immunité et la cicatrisation. Souvent déficitaire chez les sportifs.',
 ARRAY['Testostérone','Immunité','Cicatrisation','Antioxydant'],
 ARRAY['avant_dormir']),

('ZMA (Zinc + Magnésium + B6)', 'mineral',
 'Formule combinant zinc, magnésium et vitamine B6 pour optimiser la récupération nocturne et les hormones.',
 ARRAY['Récupération nocturne','Testostérone','Qualité du sommeil'],
 ARRAY['avant_dormir']),

('Fer', 'mineral',
 'Composant central de l'hémoglobine. Une carence entraîne fatigue et baisse des performances.',
 ARRAY['Transport de l'oxygène','Anti-fatigue','Performance aérobie'],
 ARRAY['petit_dejeuner']),

('Calcium', 'mineral',
 'Indispensable à la solidité osseuse et à la contraction musculaire.',
 ARRAY['Santé osseuse','Contraction musculaire','Dents'],
 ARRAY['petit_dejeuner','diner']),

('Potassium', 'mineral',
 'Électrolyte essentiel à l'équilibre hydrique et à la fonction musculaire.',
 ARRAY['Équilibre électrolytique','Prévention des crampes','Pression artérielle'],
 ARRAY['post_workout','diner']),

('Iode', 'mineral',
 'Nécessaire à la synthèse des hormones thyroïdiennes qui régulent le métabolisme.',
 ARRAY['Métabolisme','Thyroïde','Énergie'],
 ARRAY['petit_dejeuner']),

-- BOOSTERS / PERFORMANCE
('Caféine', 'booster',
 'Stimulant du système nerveux central. Améliore la vigilance, la concentration et la performance sportive.',
 ARRAY['Énergie','Concentration','Performance','Brûleur de graisses'],
 ARRAY['pre_workout','petit_dejeuner']),

('Pré-Workout (complexe)', 'booster',
 'Formule multi-ingrédients combinant stimulants, vasodilatateurs et acides aminés pour maximiser la performance.',
 ARRAY['Énergie explosive','Pompe musculaire','Endurance','Focus'],
 ARRAY['pre_workout']),

('Ashwagandha (KSM-66)', 'booster',
 'Adaptogène qui réduit le cortisol (hormone du stress), améliore la récupération et soutient la testostérone.',
 ARRAY['Réduction du stress','Taux de testostérone','Récupération','Sommeil'],
 ARRAY['diner','avant_dormir']),

('Rhodiola Rosea', 'booster',
 'Plante adaptogène qui améliore la résistance à la fatigue physique et mentale.',
 ARRAY['Anti-fatigue','Endurance mentale','Gestion du stress'],
 ARRAY['petit_dejeuner','pre_workout']),

('Tribulus Terrestris', 'booster',
 'Plante utilisée pour soutenir la libido et les niveaux de testostérone.',
 ARRAY['Libido','Testostérone','Énergie'],
 ARRAY['petit_dejeuner']),

-- RÉCUPÉRATION
('Oméga-3 (EPA/DHA)', 'recovery',
 'Acides gras essentiels à la protection cardiovasculaire et à la réduction de l'inflammation.',
 ARRAY['Anti-inflammatoire','Santé cardiovasculaire','Récupération','Cerveau'],
 ARRAY['petit_dejeuner','diner']),

('Collagène Hydrolysé', 'recovery',
 'Protéine structurelle qui soutient les articulations, tendons, peau et os.',
 ARRAY['Articulations','Tendons','Peau','Prévention des blessures'],
 ARRAY['petit_dejeuner','post_workout']),

('Curcumine (Curcuma)', 'recovery',
 'Puissant anti-inflammatoire naturel, améliore la récupération post-entraînement.',
 ARRAY['Anti-inflammatoire','Récupération','Antioxydant','Articulations'],
 ARRAY['diner','avant_dormir']),

('Glucosamine + Chondroïtine', 'recovery',
 'Duo pour la santé des cartilages articulaires et la prévention de leur dégradation.',
 ARRAY['Cartilage','Articulations','Mobilité','Prévention des blessures'],
 ARRAY['petit_dejeuner','diner']),

('HMB (Bêta-Hydroxy Bêta-Méthylbutyrate)', 'recovery',
 'Métabolite de la leucine, puissant anti-catabolique. Utile lors des phases de sèche ou de récupération.',
 ARRAY['Anti-catabolisme','Préservation musculaire','Récupération'],
 ARRAY['post_workout','avant_dormir']),

('Électrolytes', 'recovery',
 'Mélange de sodium, potassium, magnésium et chlorure pour la réhydratation après l'effort.',
 ARRAY['Réhydratation','Prévention des crampes','Endurance'],
 ARRAY['post_workout','pre_workout']),

('Spiruline', 'recovery',
 'Super-aliment riche en protéines, fer, antioxydants et vitamines B. Soutient l'immunité et l'énergie.',
 ARRAY['Énergie','Immunité','Antioxydant','Fer'],
 ARRAY['petit_dejeuner','collation_matin']),

-- SANTÉ GÉNÉRALE
('Probiotiques', 'health',
 'Bactéries bénéfiques qui renforcent le microbiote intestinal et l'immunité.',
 ARRAY['Microbiote','Immunité','Digestion','Absorption des nutriments'],
 ARRAY['petit_dejeuner','avant_dormir']),

('Vitamine D3 + K2', 'health',
 'Association synergique pour la santé osseuse et cardiovasculaire. La K2 guide le calcium vers les os.',
 ARRAY['Santé osseuse','Cardiovasculaire','Immunité'],
 ARRAY['petit_dejeuner']),

('Huile de poisson', 'health',
 'Source naturelle d'oméga-3 EPA et DHA. Soutient le cerveau, le cœur et la réduction de l'inflammation.',
 ARRAY['Cerveau','Cœur','Anti-inflammatoire'],
 ARRAY['petit_dejeuner','diner']),

('Charbon Actif', 'health',
 'Aide à éliminer les toxines et les gaz digestifs. À utiliser ponctuellement.',
 ARRAY['Détox','Ballonnements','Digestion'],
 ARRAY['collation']),

('Mélatonine', 'health',
 'Hormone du sommeil. Aide à s'endormir plus vite et à réguler le cycle circadien.',
 ARRAY['Endormissement','Qualité du sommeil','Récupération'],
 ARRAY['avant_dormir']),

('5-HTP', 'health',
 'Précurseur de la sérotonine et de la mélatonine. Améliore l'humeur et le sommeil.',
 ARRAY['Humeur','Sommeil','Anxiété'],
 ARRAY['diner','avant_dormir']),

('Resvératrol', 'health',
 'Antioxydant puissant présent dans le raisin. Soutient la longévité cellulaire et la santé cardiovasculaire.',
 ARRAY['Antioxydant','Cardiovasculaire','Anti-âge'],
 ARRAY['diner']),

('NAC (N-Acétyl Cystéine)', 'health',
 'Précurseur du glutathion, le principal antioxydant de l'organisme. Soutient le foie et l'immunité.',
 ARRAY['Antioxydant','Foie','Immunité','Détox'],
 ARRAY['petit_dejeuner','avant_dormir']),

('Ginseng', 'health',
 'Adaptogène classique qui améliore l'énergie, la cognition et la résistance au stress.',
 ARRAY['Énergie','Concentration','Adaptogène','Immunité'],
 ARRAY['petit_dejeuner']);
