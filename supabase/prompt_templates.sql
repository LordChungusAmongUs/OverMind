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
('wardrobe_analysis', 'Item Analysis', '{{imageNote}} Return ONLY a JSON object — no markdown, no explanation.

Product: {{productName}}
{{brandLine}}

{{focusNote}}

{
  "count": <total individual pieces in this purchase e.g. 1 for single, 7 for a 7-pack>,
  "items": [
    {
      "item_type": "<exact item type matching the product name e.g. boxer brief, t-shirt, crew sock>",
      "color": "<specific color>",
      "brand": "<brand or null>",
      "occasions": [<from: Casual, Work, Gym, Going Out, Date Night, Errands, Church, Travel, Formal>],
      "style_notes": "<one sentence about cut, fit, material>"
    }
  ]
}

Rules:
- items[] length must NEVER exceed count
- Single item → count:1, one entry
- Multi-pack same color → count:N, one entry
- Multi-pack different colors → count:total pieces, one entry PER unique color
- Variety pack → list most likely colors, items[].length must equal count'),

('wardrobe_generation', 'Catalog Image Generation', 'Generate a clean, professional catalog photograph of this exact clothing item:

Item: {{brand}}{{color}} {{item_type}}{{styleNotes}}

Requirements:
- Generate ONLY a {{item_type}} — do not generate any other garment or accessory
- {{color}} color — match this exactly
- Plain white or very light neutral background
- NO model, NO mannequin, NO person — garment only
- Flat lay, hanging, or ghost-mannequin style — whichever looks most professional for this item type
- Full item visible, sharp focus, clean retail lighting
- Quality matching a premium brand''s official product page')

ON CONFLICT (key) DO NOTHING;
