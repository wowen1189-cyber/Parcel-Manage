-- One AppFolio tenant file is a short video (a pet). Let the documents bucket keep phone videos too.
update storage.buckets
set allowed_mime_types = array_cat(allowed_mime_types, array['video/quicktime', 'video/mp4'])
where id = 'documents' and not ('video/mp4' = any(allowed_mime_types));
