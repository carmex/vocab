-- Update generate_class_code to exclude ambiguous characters (I, L, 1, O, 0)
CREATE OR REPLACE FUNCTION generate_class_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  -- Removed I, L, 1, O, 0
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text := '';
  v_exists boolean;
BEGIN
  LOOP
    v_code := '';
    -- Generate 6 char code
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    SELECT EXISTS(SELECT 1 FROM classrooms WHERE code = v_code) INTO v_exists;
    IF NOT v_exists THEN
      RETURN v_code;
    END IF;
  END LOOP;
END;
$$;
