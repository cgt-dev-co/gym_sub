import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { planService, paymentService, subscriptionService } from '../services/api'
import { toast } from 'react-toastify'
import LoadingSpinner from '../components/LoadingSpinner'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)

const CheckoutForm = ({ plan, onSuccess, onCancel }) => {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!stripe || !elements) return

    setLoading(true)

    try {
      const { clientSecret, paymentIntentId } = await paymentService.createPaymentIntent(plan.id)

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)
        }
      })

      if (error) {
        toast.error(error.message)
      } else if (paymentIntent.status === 'succeeded') {
        await subscriptionService.purchase(plan.id, paymentIntentId)
        toast.success('Subscription purchased successfully!')
        onSuccess()
      }
    } catch (error) {
      toast.error(error.error || 'Payment failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Card Details
        </label>
        <div className="border border-gray-300 rounded-lg p-3">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': {
                    color: '#aab7c4'
                  }
                },
                invalid: {
                  color: '#9e2146'
                }
              }
            }}
          />
        </div>
      </div>
      <div className="flex space-x-3">
        <button
          type="submit"
          disabled={!stripe || loading}
          className="btn btn-primary flex-1"
        >
          {loading ? 'Processing...' : `Pay $${plan.price}`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

const Plans = () => {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadPlans()
  }, [])

  const loadPlans = async () => {
    try {
      const response = await planService.getAll()
      setPlans(response.plans)
    } catch (error) {
      toast.error('Failed to load plans')
    } finally {
      setLoading(false)
    }
  }

  const getDurationText = (duration) => {
    const map = {
      MONTHLY: 'per month',
      QUARTERLY: 'per 3 months',
      YEARLY: 'per year'
    }
    return map[duration] || duration
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        Subscription Plans
      </h1>

      {selectedPlan ? (
        <div className="max-w-md mx-auto card">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Checkout: {selectedPlan.name}
          </h2>
          <p className="text-3xl font-bold text-primary-600 mb-6">
            ${selectedPlan.price} <span className="text-lg text-gray-600">{getDurationText(selectedPlan.duration)}</span>
          </p>
          <Elements stripe={stripePromise}>
            <CheckoutForm
              plan={selectedPlan}
              onSuccess={() => {
                setSelectedPlan(null)
                navigate('/my-subscription')
              }}
              onCancel={() => setSelectedPlan(null)}
            />
          </Elements>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div key={plan.id} className="card hover:shadow-xl transition-shadow">
              <h3 className="text-2xl font-bold text-gray-800 mb-2">
                {plan.name}
              </h3>
              <p className="text-3xl font-bold text-primary-600 mb-4">
                ${plan.price}
                <span className="text-lg text-gray-600 ml-1">
                  {getDurationText(plan.duration)}
                </span>
              </p>
              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start text-sm">
                    <span className="text-primary-600 mr-2">✓</span>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setSelectedPlan(plan)}
                className="btn btn-primary w-full"
              >
                Select Plan
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Plans
