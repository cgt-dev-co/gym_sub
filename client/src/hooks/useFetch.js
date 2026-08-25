import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'react-toastify'

export const useFetch = (fetchFn, immediate = true) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState(null)
  const fetchFnRef = useRef(fetchFn)
  fetchFnRef.current = fetchFn

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchFnRef.current()
      setData(result)
      return result
    } catch (err) {
      const errorMsg = err.error || err.message || 'Failed to load data'
      setError(errorMsg)
      toast.error(errorMsg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (immediate) {
      refetch()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, refetch }
}

export const useMultiFetch = (fetchFns, immediate = true) => {
  const [results, setResults] = useState({})
  const [loading, setLoading] = useState(immediate)
  const fetchFnsRef = useRef(fetchFns)
  fetchFnsRef.current = fetchFns

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const currentFetchFns = fetchFnsRef.current
      const settled = await Promise.allSettled(
        currentFetchFns.map(({ fn }) => fn())
      )
      const nextResults = {}
      currentFetchFns.forEach(({ name }, idx) => {
        const settlement = settled[idx]
        nextResults[name] = {
          data: settlement.status === 'fulfilled' ? settlement.value : null,
          error: settlement.status === 'rejected' ? settlement.reason : null
        }
        if (settlement.status === 'rejected') {
          const msg = settlement.reason?.error || settlement.reason?.message || `Failed to load ${name}`
          toast.error(msg)
        }
      })
      setResults(nextResults)
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (immediate) {
      refetch()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { results, loading, refetch }
}
