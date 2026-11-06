/**
 * AdminInventoryPage
 *
 * Displays current stock levels as reported by the Python Warehouse service
 * (via Laravel's ProductResource → stock_quantity). Stock is managed by the
 * Warehouse service and cannot be edited directly from this dashboard.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Chip,
  Container,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import { productsService } from '@/features/products/services/productsService'
import type { Product } from '@/features/products/types/product.types'
import { formatCurrency } from '@/shared/lib/formatters'
import ErrorMessage from '@/shared/components/feedback/ErrorMessage'
import ProductSearch from '@/features/products/components/ProductSearch'
import { useDebounce } from '@/shared/hooks/useDebounce'

export default function AdminInventoryPage() {
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 350)

  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await productsService.list({
        page: 1,
        perPage: 200,
        filters: { search: '', category: 'All', sort: 'name' },
      })
      setAllProducts(res.items)
    } catch (e) {
      setError(
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: unknown }).message)
          : 'Failed to load inventory.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = debouncedSearch.trim()
    ? allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        p.category.toLowerCase().includes(debouncedSearch.toLowerCase()),
    )
    : allProducts

  const lowStockCount = allProducts.filter((p) => p.stock <= 10).length

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      <Typography variant="h3" component="h1" sx={{ fontWeight: 700, mb: 0.5 }}>
        Inventory
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Stock levels are read from the Warehouse service in real time.
      </Typography>

      <Alert severity="info" icon={<InfoOutlined />} sx={{ mb: 3, borderRadius: 2 }}>
        Stock quantities are managed by the Warehouse service. They update automatically
        when orders are placed and fulfilled.
      </Alert>

      {lowStockCount > 0 && !loading && (
        <Alert
          severity="warning"
          icon={<WarningAmberOutlined />}
          sx={{ mb: 3, borderRadius: 2 }}
        >
          {lowStockCount} product{lowStockCount !== 1 ? 's are' : ' is'} low on stock or out of stock.
        </Alert>
      )}

      <Box sx={{ maxWidth: 360, mb: 2 }}>
        <ProductSearch value={searchInput} onChange={setSearchInput} />
      </Box>

      {error ? (
        <ErrorMessage error={error} onRetry={load} />
      ) : loading ? (
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
      ) : (
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Price</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Stock</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>
                    No products found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((product) => (
                  <TableRow
                    key={product.id}
                    hover
                    sx={
                      product.stock === 0
                        ? { bgcolor: 'error.50' }
                        : product.stock <= 10
                          ? { bgcolor: 'warning.50' }
                          : {}
                    }
                  >
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        {product.stock <= 10 && (
                          <WarningAmberOutlined
                            fontSize="small"
                            sx={{ color: product.stock === 0 ? 'error.main' : 'warning.main' }}
                          />
                        )}
                        <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }} noWrap>
                          {product.name}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip label={product.category} size="small" sx={{ bgcolor: 'action.hover' }} />
                    </TableCell>
                    <TableCell>{formatCurrency(product.price)}</TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600 }}>
                        {product.stock}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={
                          product.stock === 0
                            ? 'Out of stock'
                            : product.stock <= 10
                              ? 'Low stock'
                              : 'In stock'
                        }
                        size="small"
                        color={
                          product.stock === 0
                            ? 'error'
                            : product.stock <= 10
                              ? 'warning'
                              : 'success'
                        }
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Box>
      )}
    </Container>
  )
}
