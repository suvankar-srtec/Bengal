CREATE TABLE IF NOT EXISTS public.bbc_event_content (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  section_label VARCHAR(100) NOT NULL,
  title_bn VARCHAR(160) NOT NULL,
  title_en VARCHAR(160) NOT NULL,
  tagline_line_1 VARCHAR(180) NOT NULL,
  tagline_line_2 VARCHAR(180) NOT NULL,
  event_date DATE NOT NULL,
  organizer VARCHAR(160) NOT NULL,
  about_title VARCHAR(220) NOT NULL,
  about_paragraph_1 TEXT NOT NULL,
  about_paragraph_2 TEXT NOT NULL,
  bengali_paragraph_1 TEXT NOT NULL,
  bengali_paragraph_2 TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.bbc_event_content (
  id, section_label, title_bn, title_en, tagline_line_1, tagline_line_2,
  event_date, organizer, about_title, about_paragraph_1, about_paragraph_2,
  bengali_paragraph_1, bengali_paragraph_2
) VALUES (
  1,
  'THE CONVERSATIONS THAT CONNECT US',
  'আলাপ আলোচনা',
  'Aalap Alochona',
  'A conversation today.',
  'A collaboration tomorrow.',
  '2026-09-29',
  'Bengal Business Council',
  'Good business begins with a conversation.',
  'Aalap Alochona is the official networking format of the Bengal Business Council. A space to go beyond introductions, exchange ideas, and build meaningful professional and personal relationships.',
  'Understand each other’s businesses, explore collaborations, and grow together through trust and mutual support.',
  '‘আলাপ আলোচনা’ হলো Bengal Business Council-এর আনুষ্ঠানিক নেটওয়ার্কিং প্ল্যাটফর্ম, যার উদ্দেশ্য সদস্যদের মধ্যে শুধুমাত্র পরিচয়ের গণ্ডি পেরিয়ে অর্থবহ পেশাগত ও ব্যক্তিগত সম্পর্ক গড়ে তোলা।',
  'এই উদ্যোগ সদস্যদের একে অপরের ব্যবসা ও কর্মকাণ্ড সম্পর্কে আরও ভালোভাবে জানার, অভিজ্ঞতা ও ভাবনার আদান-প্রদান করার, পারস্পরিক সহযোগিতার সম্ভাবনা খুঁজে দেখার এবং সদস্যদের মধ্যে আস্থা, সৌহার্দ্য ও সহযোগিতার সম্পর্ক আরও দৃঢ় করার সুযোগ করে দেয়।'
)
ON CONFLICT (id) DO NOTHING;
