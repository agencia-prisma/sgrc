CREATE TABLE public.sales_order_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES public.profiles (id) ON DELETE CASCADE,
  order_id uuid NOT NULL
    REFERENCES public.sales_orders (id) ON DELETE CASCADE,
  notification_type text NOT NULL
    CHECK (notification_type IN ('approved', 'rejected')),
  title text NOT NULL,
  message text NOT NULL,
  email_status text NOT NULL DEFAULT 'pending'
    CHECK (email_status IN ('pending', 'sent', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX sales_order_notifications_user_created_at_idx
  ON public.sales_order_notifications (user_id, created_at DESC);
CREATE INDEX sales_order_notifications_order_created_at_idx
  ON public.sales_order_notifications (order_id, created_at DESC);

ALTER TABLE public.sales_order_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.sales_order_notifications
  FROM anon, authenticated;
GRANT SELECT ON TABLE public.sales_order_notifications TO authenticated;
GRANT UPDATE (read_at) ON TABLE public.sales_order_notifications
  TO authenticated;
GRANT ALL ON TABLE public.sales_order_notifications TO service_role;

CREATE POLICY "Users can read their own sales order notifications"
  ON public.sales_order_notifications
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can mark their own sales order notifications as read"
  ON public.sales_order_notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE FUNCTION public.create_sales_order_review_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  notification_type text;
  notification_title text;
BEGIN
  IF OLD.status = 'pending_approval'::public.sales_order_status
    AND NEW.status IN (
      'approved'::public.sales_order_status,
      'rejected'::public.sales_order_status
    )
  THEN
    notification_type := NEW.status::text;
    notification_title := CASE NEW.status
      WHEN 'approved'::public.sales_order_status THEN 'Pedido aprovado'
      ELSE 'Pedido rejeitado'
    END;

    INSERT INTO public.sales_order_notifications (
      user_id,
      order_id,
      notification_type,
      title,
      message
    )
    VALUES (
      NEW.owner_user_id,
      NEW.id,
      notification_type,
      notification_title,
      CASE NEW.status
        WHEN 'approved'::public.sales_order_status THEN
          'Seu pedido para ' || NEW.customer_name_snapshot || ' foi aprovado.'
        ELSE
          'Seu pedido para ' || NEW.customer_name_snapshot || ' foi rejeitado. '
            || 'Motivo: ' || NEW.rejection_reason
      END
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_sales_order_review_notification()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER create_sales_order_review_notification
  AFTER UPDATE OF status ON public.sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_sales_order_review_notification();
