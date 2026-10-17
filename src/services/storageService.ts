import { supabase, isSupabaseConfigured } from '../lib/supabase';

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const MAX_DOC_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export interface UploadedImageResult {
  path: string;
  publicUrl: string;
}

export const storageService = {
  /**
   * Validate an image file before upload
   */
  validateImageFile(file: File): { valid: boolean; error?: string } {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: `"${file.name}" has unsupported format (${file.type || 'unknown'}). Supported formats: JPG, PNG, WebP.`,
      };
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      return {
        valid: false,
        error: `"${file.name}" (${sizeMb} MB) exceeds maximum allowed size of 10 MB.`,
      };
    }
    return { valid: true };
  },

  /**
   * Validate an owner verification document before upload
   */
  validateDocumentFile(file: File): { valid: boolean; error?: string } {
    if (!ALLOWED_DOC_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: `"${file.name}" is unsupported. Please upload a PDF, JPG, or PNG document.`,
      };
    }
    if (file.size > MAX_DOC_SIZE_BYTES) {
      return {
        valid: false,
        error: `"${file.name}" exceeds the 15 MB document size limit.`,
      };
    }
    return { valid: true };
  },

  /**
   * Upload property photo to public 'property-images' bucket
   * Stored at: {ownerId}/{listingId}/{timestamp}_{filename}
   */
  async uploadPropertyImage(
    ownerId: string,
    listingId: string,
    file: File
  ): Promise<UploadedImageResult> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase client is not configured.');
    }

    const validation = this.validateImageFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Sanitize filename to prevent path traversal or invalid characters
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const filePath = `${ownerId}/${listingId}/${timestamp}_${sanitizedName}`;

    // Upload with auto-retry
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { error } = await supabase.storage
          .from('property-images')
          .upload(filePath, file, {
            contentType: file.type,
            upsert: true,
            cacheControl: '3600',
          });

        if (error) {
          if (error.message.includes('row-level security') || error.message.includes('violates')) {
            throw new Error(
              `Upload failed: 'storage.objects' table in Supabase requires an INSERT policy for bucket 'property-images'. Please run the storage policy in the Supabase SQL Editor.`
            );
          }
          throw new Error(`Upload to storage failed: ${error.message}`);
        }


        // Get public URL
        const { data: publicData } = supabase.storage
          .from('property-images')
          .getPublicUrl(filePath);

        if (!publicData || !publicData.publicUrl) {
          throw new Error('Could not resolve public URL for uploaded property image.');
        }

        return {
          path: filePath,
          publicUrl: publicData.publicUrl,
        };
      } catch (err: any) {
        lastError = err;
        if (attempt === 1) {
          // Short backoff before retry
          await new Promise(res => setTimeout(res, 500));
        }
      }
    }

    throw lastError || new Error(`Failed to upload ${file.name} to property-images storage.`);
  },

  /**
   * Delete uploaded property images (e.g. for rollback if metadata insert fails)
   */
  async deletePropertyImages(filePaths: string[]): Promise<void> {
    if (!isSupabaseConfigured || !supabase || filePaths.length === 0) return;
    try {
      await supabase.storage.from('property-images').remove(filePaths);
    } catch (err) {
      console.warn('Storage cleanup notice:', err);
    }
  },

  /**
   * Delete specific image URLs from property-images storage
   */
  async deleteImagesByUrls(imageUrls: string[]): Promise<void> {
    if (!isSupabaseConfigured || !supabase || imageUrls.length === 0) return;
    const paths: string[] = [];
    const marker = '/property-images/';
    for (const url of imageUrls) {
      const idx = url.indexOf(marker);
      if (idx !== -1) {
        const relativePath = decodeURIComponent(url.substring(idx + marker.length).split('?')[0]);
        if (relativePath) {
          paths.push(relativePath);
        }
      }
    }
    if (paths.length > 0) {
      await this.deletePropertyImages(paths);
    }
  },

  /**
   * Delete all images and documents for a listing folder from Supabase storage
   */
  async deleteListingFolder(ownerId: string, listingId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      // 1. List and remove from property-images
      const folderPath = `${ownerId}/${listingId}`;
      const { data: imageFiles } = await supabase.storage
        .from('property-images')
        .list(folderPath);

      if (imageFiles && imageFiles.length > 0) {
        const pathsToRemove = imageFiles.map(f => `${folderPath}/${f.name}`);
        await supabase.storage.from('property-images').remove(pathsToRemove);
      }

      // 2. Also check and clean owner-documents folder
      const { data: docFiles } = await supabase.storage
        .from('owner-documents')
        .list(folderPath);

      if (docFiles && docFiles.length > 0) {
        const docPathsToRemove = docFiles.map(f => `${folderPath}/${f.name}`);
        await supabase.storage.from('owner-documents').remove(docPathsToRemove);
      }
    } catch (err) {
      console.warn('Notice deleting listing files from storage:', err);
    }
  },

  /**
   * Upload owner verification document to private 'owner-documents' bucket
   */
  async uploadOwnerDocument(
    ownerId: string,
    listingId: string,
    file: File,
    category: string
  ): Promise<{ path: string }> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase client is not configured.');
    }

    const validation = this.validateDocumentFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${ownerId}/${listingId}/${category}_${Date.now()}_${sanitizedName}`;

    const { error } = await supabase.storage
      .from('owner-documents')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true,
      });

    if (error) {
      throw new Error(`Failed to upload document: ${error.message}`);
    }

    return { path: filePath };
  },

  /**
   * Create short-lived signed URL for auditing private owner verification documents
   */
  async createSignedDocumentUrl(filePath: string, expiresInSeconds = 300): Promise<string> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.storage
      .from('owner-documents')
      .createSignedUrl(filePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new Error(`Could not generate secure view URL: ${error?.message || 'Unknown error'}`);
    }

    return data.signedUrl;
  },
};
