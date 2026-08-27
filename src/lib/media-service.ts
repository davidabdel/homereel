import { createSupabaseClient } from './supabase';

/**
 * Uploads an image file to Supabase storage and creates a database record
 */
export async function uploadUserImage(userId: string, file: File) {
  const supabase = createSupabaseClient();
  
  try {
    // Generate a unique file path
    const filePath = `${userId}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    
    // Upload the file to storage
    const { error } = await supabase.storage
      .from('user-images')
      .upload(filePath, file);
      
    if (error) throw error;
    
    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('user-images')
      .getPublicUrl(filePath);
      
    // Store reference in the database
    const { data: mediaRecord, error: dbError } = await supabase
      .from('user_media')
      .insert({
        user_id: userId,
        media_type: 'image',
        title: file.name,
        storage_path: filePath,
        content_type: file.type,
        size: file.size,
        // You might want to extract width/height from the image
      })
      .select()
      .single();
      
    if (dbError) throw dbError;
    
    return { success: true, mediaRecord, publicUrl };
  } catch (error) {
    console.error('Error uploading image:', error);
    return { success: false, error };
  }
}

/**
 * Uploads a video file and its thumbnail to Supabase storage and creates a database record
 */
export async function uploadUserVideo(userId: string, videoFile: File, thumbnailFile: File) {
  const supabase = createSupabaseClient();
  
  try {
    // Generate unique file paths
    const videoPath = `${userId}/${Date.now()}-${videoFile.name.replace(/\s+/g, '_')}`;
    const thumbnailPath = `${userId}/${Date.now()}-thumbnail-${thumbnailFile.name.replace(/\s+/g, '_')}`;
    
    // Upload the video
    const { error: videoError } = await supabase.storage
      .from('user-videos')
      .upload(videoPath, videoFile);
      
    if (videoError) throw videoError;
    
    // Upload the thumbnail
    const { error: thumbnailError } = await supabase.storage
      .from('thumbnails')
      .upload(thumbnailPath, thumbnailFile);
      
    if (thumbnailError) throw thumbnailError;
    
    // Get public URLs
    const { data: { publicUrl: videoUrl } } = supabase.storage
      .from('user-videos')
      .getPublicUrl(videoPath);
      
    const { data: { publicUrl: thumbnailUrl } } = supabase.storage
      .from('thumbnails')
      .getPublicUrl(thumbnailPath);
    
    // Store reference in the database
    const { data: mediaRecord, error: dbError } = await supabase
      .from('user_media')
      .insert({
        user_id: userId,
        media_type: 'video',
        title: videoFile.name,
        storage_path: videoPath,
        thumbnail_path: thumbnailPath,
        content_type: videoFile.type,
        size: videoFile.size,
        // You might want to extract duration/dimensions from the video
      })
      .select()
      .single();
      
    if (dbError) throw dbError;
    
    return { success: true, mediaRecord, videoUrl, thumbnailUrl };
  } catch (error) {
    console.error('Error uploading video:', error);
    return { success: false, error };
  }
}

/**
 * Get all media items for a user
 */
export async function getUserMedia(userId: string) {
  const supabase = createSupabaseClient();
  
  try {
    const { data, error } = await supabase
      .from('user_media')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    // Add public URLs to each media item
    const mediaWithUrls = data.map(item => {
      let mediaUrl, thumbnailUrl;
      
      if (item.media_type === 'image') {
        mediaUrl = supabase.storage
          .from('user-images')
          .getPublicUrl(item.storage_path).data.publicUrl;
      } else if (item.media_type === 'video') {
        mediaUrl = supabase.storage
          .from('user-videos')
          .getPublicUrl(item.storage_path).data.publicUrl;
          
        if (item.thumbnail_path) {
          thumbnailUrl = supabase.storage
            .from('thumbnails')
            .getPublicUrl(item.thumbnail_path).data.publicUrl;
        }
      }
      
      return {
        ...item,
        mediaUrl,
        thumbnailUrl,
      };
    });
    
    return { success: true, media: mediaWithUrls };
  } catch (error) {
    console.error('Error getting user media:', error);
    return { success: false, error };
  }
}
