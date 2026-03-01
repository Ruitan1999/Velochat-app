-- Add image_url column to messages for attachments
alter table public.messages add column if not exists image_url text;

-- Create storage bucket for chat attachments (run manually in Dashboard if needed)
-- insert into storage.buckets (id, name, public) values ('chat-attachments', 'chat-attachments', true);
