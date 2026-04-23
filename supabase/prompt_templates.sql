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
      "item_type": "<exact item type e.g. boxer brief, t-shirt, crew sock>",
      "color": "<color and any pattern/print AS SEEN IN THE IMAGE — e.g. navy blue, red, white with geometric print>",
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
- Generate ONLY a {{item_type}} — do not generate any other garment or accessory
- Color/pattern: {{color}} — reproduce this exactly; if a pattern or print is mentioned (e.g. geometric, stripe, logo), include it faithfully
- Plain white or very light neutral background
- NO model, NO mannequin, NO person — garment only
- Flat lay, hanging, or ghost-mannequin style — whichever looks most professional for this item type
- Full item visible, sharp focus, clean retail lighting
- Quality matching a premium brand''s official product page')

ON CONFLICT (key) DO UPDATE SET body = EXCLUDED.body, updated_at = NOW();
