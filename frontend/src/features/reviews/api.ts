/** Avis clients et enquête de satisfaction (étape 13) : appels d'API + hooks TanStack Query */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { http } from '@/lib/http'
import type { ReviewsResponse, SurveyAnswer, SurveyInfo } from '@/types/api'

export const fetchReviews = async (page = 1, perPage = 6) =>
  (await http.get<ReviewsResponse>('/reviews', { params: { page, per_page: perPage } })).data

export const useReviews = (page = 1, perPage = 6) =>
  useQuery({ queryKey: ['reviews', page, perPage], queryFn: () => fetchReviews(page, perPage), placeholderData: keepPreviousData, staleTime: 5 * 60_000 })

export const useSurvey = (token: string) =>
  useQuery({ queryKey: ['survey', token], queryFn: async () => (await http.get<{ data: SurveyInfo }>(`/surveys/${encodeURIComponent(token)}`)).data.data, retry: false })

export const useAnswerSurvey = (token: string) =>
  useMutation({
    mutationFn: async (body: SurveyAnswer) =>
      (await http.post<{ data: { state: 'answered'; follow_up: boolean } }>(`/surveys/${encodeURIComponent(token)}`, body)).data.data,
  })
