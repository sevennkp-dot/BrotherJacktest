-- SQL Fix for Technician Ratings Default
-- RUN THIS IN YOUR SUPABASE SQL EDITOR

-- 1. Reset all technicians who have rating 5 but have ZERO reviews to NULL (shows "New")
UPDATE public.technicians
SET rating = NULL
WHERE rating = 5 
  AND id NOT IN (SELECT DISTINCT technician_id FROM public.reviews);

-- 2. (Optional) Create a function to automatically calculate and update average rating
CREATE OR REPLACE FUNCTION public.update_technician_average_rating() 
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        UPDATE public.technicians
        SET rating = (
            SELECT ROUND(AVG(rating)::numeric, 1)
            FROM public.reviews
            WHERE technician_id = NEW.technician_id
        )
        WHERE id = NEW.technician_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.technicians
        SET rating = (
            SELECT ROUND(AVG(rating)::numeric, 1)
            FROM public.reviews
            WHERE technician_id = OLD.technician_id
        )
        WHERE id = OLD.technician_id;
        
        -- If no reviews left, set to NULL (New)
        UPDATE public.technicians
        SET rating = NULL
        WHERE id = OLD.technician_id
          AND NOT EXISTS (SELECT 1 FROM public.reviews WHERE technician_id = OLD.technician_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger on the reviews table
DROP TRIGGER IF EXISTS tr_update_tech_rating ON public.reviews;
CREATE TRIGGER tr_update_tech_rating
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.update_technician_average_rating();

-- 4. Initial sync for all technicians who already have reviews
UPDATE public.technicians t
SET rating = (
    SELECT ROUND(AVG(rating)::numeric, 1)
    FROM public.reviews r
    WHERE r.technician_id = t.id
)
WHERE EXISTS (SELECT 1 FROM public.reviews r WHERE r.technician_id = t.id);
