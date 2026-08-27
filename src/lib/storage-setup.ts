import { createSupabaseClient } from './supabase';

/**
 * Sets up storage buckets for the application
 * Run this function once during application initialization or as an admin function
 */
export async function setupStorageBuckets() {
  const supabase = createSupabaseClient();
  
  try {
    // List existing buckets
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return { success: false, error: listError };
    }
    
    const existingBuckets = buckets?.map(b => b.name) || [];
    const requiredBuckets = ['user-images', 'user-videos', 'thumbnails'];
    const results = [];
    
    // Create each bucket if it doesn't exist
    for (const bucketName of requiredBuckets) {
      if (!existingBuckets.includes(bucketName)) {
        const { error } = await supabase.storage.createBucket(bucketName, {
          public: false, // Set to true if you want the files to be publicly accessible
          fileSizeLimit: 52428800, // 50MB limit (adjust as needed)
        });
        
        results.push({
          bucket: bucketName,
          success: !error,
          error: error || null,
        });
        
        if (error) {
          console.error(`Error creating bucket ${bucketName}:`, error);
        } else {
          console.log(`Created bucket: ${bucketName}`);
        }
      } else {
        console.log(`Bucket already exists: ${bucketName}`);
        results.push({
          bucket: bucketName,
          success: true,
          exists: true,
        });
      }
    }
    
    return { success: true, results };
  } catch (error) {
    console.error('Unexpected error setting up storage:', error);
    return { success: false, error };
  }
}

// Example usage in a script or admin page
// async function initializeStorage() {
//   const result = await setupStorageBuckets();
//   console.log('Storage setup result:', result);
// }
