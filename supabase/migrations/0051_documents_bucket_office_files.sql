-- Documents brought over from AppFolio include Word and Excel files and a few large scans (up to ~21 MB).
-- Each upload screen still checks its own allowed types and size; this only widens what storage accepts.
update storage.buckets
set file_size_limit = 25 * 1024 * 1024,
    allowed_mime_types = array[
      'application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp', 'image/gif',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv'
    ]
where id = 'documents';
