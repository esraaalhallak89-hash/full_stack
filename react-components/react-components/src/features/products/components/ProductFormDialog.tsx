/**
 * ProductFormDialog
 *
 * Add / Edit form for a product. Only sends fields the Laravel backend accepts:
 *   name, description, price, category
 *
 * Image upload uses a separate POST /products/{id}/image endpoint after save.
 * Fields like rating, reviewCount, featured, compareAtPrice are not in the
 * backend schema and have been removed.
 */
import { useEffect, useState, type ChangeEvent } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  TextField,
} from '@mui/material'
import { PRODUCT_CATEGORIES, type ProductInput, type ProductInputErrors } from '../types/product.types'
import { useBackendCategories } from '../hooks/useBackendCategories'

interface ProductFormDialogProps {
  open: boolean
  mode: 'add' | 'edit'
  initial: import('../types/product.types').Product | null
  loading: boolean
  onClose: () => void
  onSubmit: (input: ProductInput) => void
}

const EMPTY: ProductInput = {
  name: '',
  description: '',
  price: 0,
  category: '',
}

function validate(input: ProductInput): ProductInputErrors {
  const errors: ProductInputErrors = {}
  if (!input.name.trim()) errors.name = 'Name is required.'
  else if (input.name.trim().length < 3) errors.name = 'Name must be at least 3 characters.'
  if (!input.description.trim()) errors.description = 'Description is required.'
  else if (input.description.trim().length < 10) errors.description = 'Description must be at least 10 characters.'
  if (!input.price || isNaN(input.price) || Number(input.price) <= 0)
    errors.price = 'Price must be a positive number.'
  if (!input.category.trim()) errors.category = 'Category is required.'
  return errors
}

export default function ProductFormDialog({
  open,
  mode,
  initial,
  loading,
  onClose,
  onSubmit,
}: ProductFormDialogProps) {
  const [input, setInput] = useState<ProductInput>(EMPTY)
  const [errors, setErrors] = useState<ProductInputErrors>({})
  const [touched, setTouched] = useState(false)

  // Fetch actual categories from the backend; fall back to hardcoded list
  const { categories } = useBackendCategories()

  useEffect(() => {
    if (!open) return
    setTouched(false)
    setErrors({})
    if (mode === 'edit' && initial) {
      setInput({
        name: initial.name,
        description: initial.description,
        price: initial.price,
        category: initial.category,
      })
    } else {
      setInput({ ...EMPTY, category: categories[0] ?? '' })
    }
  }, [open, mode, initial, categories])

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target as HTMLInputElement
    const coerced = type === 'number' ? (value === '' ? 0 : Number(value)) : value
    const next = { ...input, [name]: coerced } as ProductInput
    setInput(next)
    if (touched) setErrors(validate(next))
  }

  function handleSubmit() {
    setTouched(true)
    const nextErrors = validate(input)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length === 0) {
      onSubmit({ ...input, price: Number(input.price) })
    }
  }

  const isEdit = mode === 'edit'

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {isEdit ? 'Edit product' : 'Add a new product'}
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <TextField
              name="name"
              label="Product name"
              value={input.name}
              onChange={handleChange}
              error={Boolean(errors.name)}
              helperText={errors.name}
              required
              fullWidth
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <TextField
              name="description"
              label="Description"
              value={input.description}
              onChange={handleChange}
              error={Boolean(errors.description)}
              helperText={errors.description}
              multiline
              rows={3}
              required
              fullWidth
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              name="price"
              label="Price (USD)"
              type="number"
              value={input.price}
              onChange={handleChange}
              error={Boolean(errors.price)}
              helperText={errors.price}
              slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
              required
              fullWidth
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              name="category"
              label="Category"
              select
              value={input.category}
              onChange={handleChange}
              error={Boolean(errors.category)}
              helperText={errors.category}
              fullWidth
            >
              {categories.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Add product'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
