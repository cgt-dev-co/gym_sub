import { FaDumbbell, FaUsers, FaHeartbeat, FaSpa, FaClock, FaParking } from 'react-icons/fa'
import { GiMuscleUp, GiWeightLiftingUp } from 'react-icons/gi'

const services = [
  {
    id: 1,
    icon: <FaDumbbell className="w-12 h-12" />,
    title: 'State-of-the-Art Equipment',
    description: 'Access to premium gym equipment including cardio machines, free weights, and specialized training gear.',
    features: ['Latest cardio machines', 'Full range of weights', 'Functional training area', 'Olympic lifting platforms']
  },
  {
    id: 2,
    icon: <FaUsers className="w-12 h-12" />,
    title: 'Group Fitness Classes',
    description: 'Join energizing group classes led by certified instructors for all fitness levels.',
    features: ['Yoga & Pilates', 'Spin classes', 'HIIT training', 'Dance fitness', 'Boxing & kickboxing']
  },
  {
    id: 3,
    icon: <GiMuscleUp className="w-12 h-12" />,
    title: 'Personal Training',
    description: 'One-on-one sessions with certified personal trainers to help you reach your fitness goals.',
    features: ['Customized workout plans', 'Nutrition guidance', 'Progress tracking', 'Flexible scheduling']
  },
  {
    id: 4,
    icon: <FaHeartbeat className="w-12 h-12" />,
    title: 'Health & Wellness',
    description: 'Comprehensive health services including nutrition consultation and wellness programs.',
    features: ['Nutrition counseling', 'Body composition analysis', 'Wellness workshops', 'Health assessments']
  },
  {
    id: 5,
    icon: <FaSpa className="w-12 h-12" />,
    title: 'Recovery & Spa',
    description: 'Relax and recover with our premium spa facilities including sauna and massage services.',
    features: ['Steam room & sauna', 'Massage therapy', 'Cold plunge pool', 'Recovery lounge']
  },
  {
    id: 6,
    icon: <GiWeightLiftingUp className="w-12 h-12" />,
    title: 'Specialized Programs',
    description: 'Targeted programs for specific fitness goals and athletic performance enhancement.',
    features: ['Strength & conditioning', 'Sports performance', 'Weight loss programs', 'Senior fitness']
  },
  {
    id: 7,
    icon: <FaClock className="w-12 h-12" />,
    title: '24/7 Access',
    description: 'Train on your schedule with round-the-clock gym access for premium members.',
    features: ['Secure entry system', 'Safe environment', 'Always monitored', 'No time restrictions']
  },
  {
    id: 8,
    icon: <FaParking className="w-12 h-12" />,
    title: 'Premium Amenities',
    description: 'Enjoy additional amenities designed for your comfort and convenience.',
    features: ['Free parking', 'Locker rooms', 'Showers & towel service', 'Free WiFi', 'Smoothie bar']
  }
]

function Services() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Our Services</h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Everything you need to achieve your fitness goals under one roof
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
        {services.map(service => (
          <div
            key={service.id}
            className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-shadow p-8 border border-gray-100"
          >
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 text-blue-600 bg-blue-50 p-4 rounded-lg">
                {service.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  {service.title}
                </h3>
                <p className="text-gray-600 mb-4">
                  {service.description}
                </p>
                <ul className="space-y-2">
                  {service.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-gray-700">
                      <svg
                        className="w-5 h-5 text-green-500 mr-2 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-12 text-center text-white">
        <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
        <p className="text-xl mb-8 opacity-90">
          Choose a plan that works for you and start your fitness journey today
        </p>
        <a
          href="/plans"
          className="inline-block bg-white text-blue-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors"
        >
          View Our Plans
        </a>
      </div>
    </div>
  )
}

export default Services
