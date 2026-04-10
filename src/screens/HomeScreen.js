import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { colors, spacing, borderRadius, typography } from '../theme/colors';
import ServiceCard from '../components/ServiceCard';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const firstName = user?.user_metadata?.first_name;
  const featuredServices = [
    { id: '1', title: 'Lavage Express', description: 'Extérieur rapide en 15 min', price: '15 €', icon: 'express' },
    { id: '2', title: 'Lavage Complet', description: 'Extérieur + intérieur soigné', price: '35 €', icon: 'wash' },
    { id: '3', title: 'Premium', description: 'Traitement céramique et polish', price: '89 €', icon: 'premium' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Image
            source={require('../../assets/logo-washpro.png')}
            style={styles.heroLogo}
            resizeMode="contain"
          />
          {firstName ? (
            <Text style={styles.heroWelcome}>Bonjour, {firstName} 👋</Text>
          ) : null}
          <Text style={styles.heroSubtitle}>Votre voiture mérite le meilleur</Text>
          <Text style={styles.heroTagline}>Lavage professionnel à domicile ou en centre</Text>
        </LinearGradient>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Réservez maintenant</Text>
          <Button 
            title="Prendre rendez-vous" 
            onPress={() => navigation.navigate('Réservations')}
            size="lg"
          />
        </View>

        {/* Services populaires */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nos services</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Services')}>
              <Text style={styles.seeAll}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          {featuredServices.map((service) => (
            <ServiceCard
              key={service.id}
              {...service}
              onPress={() => navigation.navigate('Services')}
            />
          ))}
        </View>

        {/* Avantages */}
        <View style={styles.benefitsSection}>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>📍</Text>
            <Text style={styles.benefitText}>À domicile ou en centre</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>🕐</Text>
            <Text style={styles.benefitText}>Disponible 7j/7</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>✨</Text>
            <Text style={styles.benefitText}>Produits écologiques</Text>
          </View>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  hero: {
    padding: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
    marginBottom: spacing.lg,
  },
  heroLogo: {
    width: 220,
    height: 100,
    marginBottom: spacing.md,
  },
  heroWelcome: {
    fontSize: typography.xxl,
    color: '#fff',
    fontWeight: typography.bold,
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    fontSize: typography.xl,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: typography.medium,
    marginBottom: spacing.xs,
  },
  heroTagline: {
    fontSize: typography.base,
    color: 'rgba(255,255,255,0.85)',
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  seeAll: {
    fontSize: typography.base,
    color: colors.primary,
    fontWeight: typography.semibold,
  },
  benefitsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  benefitItem: {
    alignItems: 'center',
  },
  benefitIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  benefitText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
