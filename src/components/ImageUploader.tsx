"use client"

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { uploadUserImage } from '@/lib/media-service'

export default function ImageUploader() {
  const { user } = useAuth()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !user) {
      return
    }

    const file = e.target.files[0]
    setIsUploading(true)
    setError(null)

    try {
      const result = await uploadUserImage(user.id, file)
      
      if (result.success && result.publicUrl) {
        setUploadedImage(result.publicUrl)
      } else {
        setError('Upload failed: ' + (result.error ? String(result.error) : 'Unknown error'))
      }
    } catch (err: any) {
      console.error('Error uploading image:', err)
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="glass-card">
      <h2 className="text-xl font-semibold mb-4">Upload Image</h2>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-white/80 mb-2">
          Select an image to upload
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={isUploading}
          className="w-full bg-[#0F1117] border border-white/10 rounded-lg px-3 py-2"
        />
      </div>
      
      {isUploading && (
        <div className="flex items-center space-x-2 mb-4">
          <div className="animate-spin h-4 w-4 border-2 border-white/60 border-t-transparent rounded-full"></div>
          <p>Uploading...</p>
        </div>
      )}
      
      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg mb-4">
          <p className="text-sm">{error}</p>
        </div>
      )}
      
      {uploadedImage && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-white/80 mb-2">Uploaded Image:</h3>
          <div className="border border-white/10 rounded-lg overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={uploadedImage} 
              alt="Uploaded" 
              className="w-full h-auto max-h-64 object-contain"
            />
          </div>
          <p className="mt-2 text-xs text-white/60 break-all">{uploadedImage}</p>
        </div>
      )}
    </div>
  )
}
