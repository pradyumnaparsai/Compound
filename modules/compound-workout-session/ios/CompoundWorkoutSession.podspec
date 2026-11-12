Pod::Spec.new do |s|
  s.name           = 'CompoundWorkoutSession'
  s.version        = '1.0.0'
  s.summary        = 'Starts a live Traditional Strength Training workout session on iPhone (iOS 26+) so it shows in Fitness.'
  s.description    = s.summary
  s.license        = 'MIT'
  s.author         = 'Compound'
  s.homepage       = 'https://example.invalid'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'HealthKit'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
