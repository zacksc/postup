import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { DEFAULT_FOLDER_TEMPLATE, DEFAULT_ROOT_FOLDER } from '@/lib/drive-folders'
import { resetFolderTemplateCache } from '@/lib/media-storage'

/**
 * Fluxo de pastas no Drive (D21): lê/salva o template, a pasta raiz, os valores
 * fixos de agência/equipe e a preferência de compressão de vídeo do usuário em
 * `user_storage_settings`. Ao salvar, invalida o cache do media-storage para os
 * próximos uploads usarem os novos valores.
 */
export function useStorageSettings(userId?: string) {
  const [template, setTemplate] = useState<string>(DEFAULT_FOLDER_TEMPLATE)
  const [rootFolder, setRootFolder] = useState<string>(DEFAULT_ROOT_FOLDER)
  const [agencia, setAgencia] = useState('')
  const [equipe, setEquipe] = useState('')
  const [compressVideos, setCompressVideos] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!userId) return
    supabase
      .from('user_storage_settings')
      .select('folder_template, root_folder, agencia, equipe, compress_videos')
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          if (data.folder_template) setTemplate(data.folder_template)
          if (data.root_folder) setRootFolder(data.root_folder)
          setAgencia(data.agencia || '')
          setEquipe(data.equipe || '')
          setCompressVideos(data.compress_videos !== false)
        }
        setLoading(false)
      })
  }, [userId])

  const save = useCallback(async (values: {
    folderTemplate: string
    rootFolder: string
    agencia: string
    equipe: string
    compressVideos: boolean
  }) => {
    if (!userId) return new Error('Usuário não autenticado')
    setSaving(true)
    const { error } = await supabase
      .from('user_storage_settings')
      .upsert({
        user_id: userId,
        folder_template: values.folderTemplate.trim(),
        root_folder: values.rootFolder.trim() || DEFAULT_ROOT_FOLDER,
        agencia: values.agencia.trim(),
        equipe: values.equipe.trim(),
        compress_videos: values.compressVideos,
      }, { onConflict: 'user_id' })
    if (!error) resetFolderTemplateCache()
    setSaving(false)
    return error
  }, [userId])

  return {
    template, setTemplate,
    rootFolder, setRootFolder,
    agencia, setAgencia,
    equipe, setEquipe,
    compressVideos, setCompressVideos,
    loading, saving, save,
  }
}
