import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { useRepositories } from '@/app/di';
import type { Photo, PhotoId } from '@/domain/entities';
import { unwrap } from '@/domain/repositories';
import { queryKeys } from '@/shared/constants/queryKeys';

/**
 * The signed-in member's own photos, including the ones not yet approved.
 *
 * Distinct from `Person.photoUrls`, which is the approved subset everybody
 * else sees. Both exist because both are needed: the owner has to see a photo
 * they just uploaded, and nobody else should.
 */
export function useMyPhotos(): UseQueryResult<Photo[], Error> {
  const { photos } = useRepositories();

  return useQuery({
    queryKey: queryKeys.photos.mine(),
    queryFn: async () => unwrap(await photos.listMyPhotos()),
  });
}

/**
 * Uploads a local file and records it.
 *
 * Not optimistic. A photo takes a second or two to upload and can genuinely
 * fail — the bucket refuses anything over 5 MB — so showing it as present
 * before it is would mean taking it away again, which is worse than a brief
 * spinner on the tile.
 */
export function useAddPhoto(): UseMutationResult<Photo, Error, string> {
  const { photos } = useRepositories();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (localUri: string) => unwrap(await photos.addPhoto(localUri)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.photos.mine() });
      // Approving happens elsewhere and later, but the profile's own cached
      // copy of the approved list is now suspect either way.
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.me() });
    },
  });
}

export function useRemovePhoto(): UseMutationResult<void, Error, PhotoId> {
  const { photos } = useRepositories();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: PhotoId) => unwrap(await photos.removePhoto(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.photos.mine() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.me() });
    },
  });
}

export function useSetPhotoOrder(): UseMutationResult<void, Error, PhotoId[]> {
  const { photos } = useRepositories();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: PhotoId[]) => unwrap(await photos.setPhotoOrder(ids)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.photos.mine() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.me() });
    },
  });
}
