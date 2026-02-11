-- ============================================================
-- Schema completo per Student Auth
-- Esegui questo SQL nel SQL Editor di Supabase
-- ATTENZIONE: questo rimpiazza lo schema precedente
-- ============================================================

-- Elimina tabelle esistenti se presenti (ordine inverso per FK)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS update_spotted_likes_count();
DROP TABLE IF EXISTS spotted_comments;
DROP TABLE IF EXISTS spotted_likes;
DROP TABLE IF EXISTS spotted;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS profiles;
DROP TABLE IF EXISTS schools;

-- ============================================================
-- 1. SCHOOLS
-- ============================================================
CREATE TABLE schools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT,
  province TEXT,
  description TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read schools"
  ON schools FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert schools"
  ON schools FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update schools"
  ON schools FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 2. PROFILES (estende auth.users)
-- ============================================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'studente' CHECK (role IN ('admin', 'co_admin', 'rappresentante', 'studente')),
  school_id UUID REFERENCES schools(id),
  classe TEXT,
  sezione TEXT,
  bio TEXT,
  avatar_url TEXT,
  banned_until TIMESTAMPTZ DEFAULT NULL,
  ban_reason TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admin and reps can read all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'co_admin', 'rappresentante')
    )
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admin can update any profile"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'co_admin')
    )
  );

CREATE POLICY "Enable insert for service role"
  ON profiles FOR INSERT
  WITH CHECK (true);

-- NOTA: il profilo viene creato dal codice in auth-signup.js
-- Non serve più un trigger su auth.users

-- ============================================================
-- 3. POSTS (post ufficiali)
-- ============================================================
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  author_id UUID REFERENCES profiles(id) NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  category TEXT DEFAULT 'altro' CHECK (category IN ('avviso', 'evento', 'circolare', 'altro')),
  pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Tutti gli utenti della stessa scuola possono leggere i post
CREATE POLICY "Users can read posts from own school"
  ON posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND school_id = posts.school_id
    )
  );

CREATE POLICY "Service role full access posts"
  ON posts FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 4. SPOTTED (post anonimi)
-- ============================================================
CREATE TABLE spotted (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  author_id UUID REFERENCES profiles(id) NOT NULL,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE spotted ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access spotted"
  ON spotted FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 5. SPOTTED_LIKES
-- ============================================================
CREATE TABLE spotted_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  spotted_id UUID REFERENCES spotted(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(spotted_id, user_id)
);

ALTER TABLE spotted_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access spotted_likes"
  ON spotted_likes FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger per aggiornare likes_count
CREATE OR REPLACE FUNCTION update_spotted_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE spotted SET likes_count = likes_count + 1 WHERE id = NEW.spotted_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE spotted SET likes_count = likes_count - 1 WHERE id = OLD.spotted_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_spotted_like_change
  AFTER INSERT OR DELETE ON spotted_likes
  FOR EACH ROW EXECUTE FUNCTION update_spotted_likes_count();

-- ============================================================
-- 6. SPOTTED_COMMENTS (commenti anonimi)
-- ============================================================
CREATE TABLE spotted_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  spotted_id UUID REFERENCES spotted(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES profiles(id) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE spotted_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access spotted_comments"
  ON spotted_comments FOR ALL
  USING (true)
  WITH CHECK (true);
