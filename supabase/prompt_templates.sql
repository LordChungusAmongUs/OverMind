-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE prompt_templates DISABLE ROW LEVEL SECURITY;

INSERT INTO prompt_templates (key, name, body) VALUES
('wardrobe_analysis', 'Item Analysis', '{{imageNote}}

CRITICAL: Identify colors by looking at the attached image — do NOT use any color mentioned in the product name or title. Amazon listings often say "Black" even when the pack contains white, red, and navy. The image is the only source of truth for color.

Return ONLY a JSON object — no markdown, no explanation.

Product type: {{productName}}
{{brandLine}}

{{focusNote}}

{
  "count": <total individual pieces in this purchase e.g. 1 for single, 7 for a 7-pack>,
  "items": [
    {
      "item_type": "<FULL garment name — never abbreviate. short sleeve t-shirt stays short sleeve t-shirt, never short. Examples: t-shirt, polo shirt, crew neck sweatshirt, athletic shorts, boxer brief, crew sock>",
      "color": "<PRIMARY BODY COLOR of the garment AS SEEN IN THE IMAGE — dominant fabric color only. Ignore logos, text, branding, or accent colors. e.g. black, navy blue, red with white stripe>",
      "brand": "<brand or null>",
      "occasions": [<from: Casual, Work, Gym, Going Out, Date Night, Errands, Church, Travel, Formal>],
      "style_notes": "<one sentence about cut, fit, material, and any visible pattern or print>"
    }
  ]
}

Rules:
- Colors come from the image only — ignore color words in the product name
- items[] length must NEVER exceed count
- Single item → count:1, one entry
- Multi-pack same color → count:N, one entry
- Multi-pack different colors → one entry PER unique color seen in the image
- Variety pack → list each distinct color visible, items[].length must equal count'),

('wardrobe_generation', 'Catalog Image Generation', '{{referenceNote}}Generate a clean, professional catalog photograph of this exact clothing item:

Item: {{brand}}{{color}} {{item_type}}{{styleNotes}}

Requirements:
- The item type is "{{item_type}}" — read it in FULL. Do NOT abbreviate or infer a different garment. "Short sleeve t-shirt" is a T-SHIRT (upper body), not shorts. "Athletic shorts" are shorts (lower body), not a shirt. Generate exactly what is named.
- PRIMARY GARMENT COLOR is {{color}} — this is the main fabric color of the body of the garment. Ignore any logo, text, or accent colors. The whole garment should be this color.
- If style notes mention a logo or print, add it as a subtle accent — it must NOT change the primary body color
- Plain white or very light neutral background
- NO model, NO mannequin, NO person — garment only
- Flat lay, hanging, or ghost-mannequin style — whichever looks most professional for this item type
- Full item visible, sharp focus, clean retail lighting
- Quality matching a premium brand''s official product page'),

('outfit_selection', 'Outfit Selection', 'You are a personal AI stylist. Pick a complete outfit from my available clean clothes.

Available items:
{{itemsList}}

Activities today: {{activities}}
Weather: {{weather}}

Return ONLY a plain bulleted list of the items to wear — one per line, no explanations:
• [exact item name]
• [exact item name]
(include every piece: top, bottom, shoes, outerwear if needed, AND always include underwear — never omit it)'),

('outfit_image', 'Outfit Image Generation', 'Now generate a high-quality, realistic full-body fashion photo of {{subject}} wearing the exact outfit items shown in the images above. Faithfully reproduce the color, cut, and style of each piece exactly as pictured. Natural studio lighting, fashion editorial style. Show the full outfit head to toe.{{accessoryDetail}}')

ON CONFLICT (key) DO UPDATE SET body = EXCLUDED.body, updated_at = NOW();
