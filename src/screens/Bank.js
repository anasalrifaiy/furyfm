import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { database } from '../firebase';
import { ref, get, update, push } from 'firebase/database';
import { showAlert, showConfirm } from '../utils/alert';

const Bank = ({ onBack }) => {
  const { currentUser, managerProfile, updateManagerProfile } = useAuth();
  const { t } = useLanguage();
  const [loanAmount, setLoanAmount] = useState('');
  const [repaymentPeriod, setRepaymentPeriod] = useState('monthly'); // 'daily', 'weekly', 'monthly'
  const [managerLoans, setManagerLoans] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [p2pLoanAmount, setP2pLoanAmount] = useState('');
  const [selectedManager, setSelectedManager] = useState(null);

  const MAX_LOAN_AMOUNT = 50000000; // $50M

  useEffect(() => {
    loadManagerLoans();
  }, [currentUser]);

  const loadManagerLoans = async () => {
    if (!currentUser) return;

    // Load loans where I'm the borrower or lender
    const loansRef = ref(database, 'loans');
    const snapshot = await get(loansRef);

    if (snapshot.exists()) {
      const allLoans = [];
      snapshot.forEach(childSnapshot => {
        const loan = { id: childSnapshot.key, ...childSnapshot.val() };
        if (loan.borrowerId === currentUser.uid || loan.lenderId === currentUser.uid) {
          allLoans.push(loan);
        }
      });
      setManagerLoans(allLoans);
    }
  };

  const searchManagers = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const managersRef = ref(database, 'managers');
    const snapshot = await get(managersRef);

    if (snapshot.exists()) {
      const results = [];
      snapshot.forEach(childSnapshot => {
        const manager = { id: childSnapshot.key, ...childSnapshot.val() };
        if (
          manager.id !== currentUser.uid &&
          manager.managerName?.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          results.push(manager);
        }
      });
      setSearchResults(results.slice(0, 10));
    }
  };

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      searchManagers();
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  const formatCurrency = (amount) => {
    return `$${(amount / 1000000).toFixed(1)}M`;
  };

  const calculateInstallment = (amount, period) => {
    const periodsPerMonth = period === 'daily' ? 30 : period === 'weekly' ? 4 : 1;
    const totalPeriods = periodsPerMonth * 6; // 6 months total
    return Math.ceil(amount / totalPeriods);
  };

  const calculateNextPayment = (period) => {
    const now = new Date();
    if (period === 'daily') {
      now.setDate(now.getDate() + 1);
    } else if (period === 'weekly') {
      now.setDate(now.getDate() + 7);
    } else {
      now.setMonth(now.getMonth() + 1);
    }
    return now.getTime();
  };

  const handleBankLoan = async () => {
    const amount = parseInt(loanAmount);

    if (!amount || amount <= 0) {
      showAlert(t('error'), t('enterValidAmount'));
      return;
    }

    if (amount > MAX_LOAN_AMOUNT) {
      showAlert(t('error'), `${t('maxLoanAmount')} ${formatCurrency(MAX_LOAN_AMOUNT)}`);
      return;
    }

    // Check if already has an active bank loan
    const activeBankLoan = managerLoans.find(
      loan => loan.type === 'bank' && loan.borrowerId === currentUser.uid && loan.status === 'active'
    );

    if (activeBankLoan) {
      showAlert(t('error'), t('alreadyHaveBankLoan'));
      return;
    }

    const installment = calculateInstallment(amount, repaymentPeriod);
    const periodText = repaymentPeriod === 'daily' ? t('daily') : repaymentPeriod === 'weekly' ? t('weekly') : t('monthly');

    showConfirm(
      t('confirmLoan'),
      `${t('loanAmount')}: ${formatCurrency(amount)}\n${t('repayment')}: ${formatCurrency(installment)} ${periodText}\n${t('duration')}: 6 ${t('months')}\n\n${t('proceedWithLoan')}`,
      async () => {
        const loansRef = ref(database, 'loans');
        const newLoanRef = await push(loansRef);

        const loan = {
          type: 'bank',
          borrowerId: currentUser.uid,
          borrowerName: managerProfile.managerName,
          amount: amount,
          remaining: amount,
          installment: installment,
          period: repaymentPeriod,
          nextPayment: calculateNextPayment(repaymentPeriod),
          status: 'active',
          createdAt: Date.now()
        };

        await update(ref(database, `loans/${newLoanRef.key}`), loan);

        await updateManagerProfile({
          budget: managerProfile.budget + amount
        });

        setLoanAmount('');
        loadManagerLoans();
        showAlert(t('success'), `${t('loanApproved')} ${formatCurrency(amount)} ${t('addedToBudget')}`);
      }
    );
  };

  const handleP2PLoanRequest = async () => {
    const amount = parseInt(p2pLoanAmount);

    if (!amount || amount <= 0) {
      showAlert(t('error'), t('enterValidAmount'));
      return;
    }

    if (!selectedManager) {
      showAlert(t('error'), t('selectManager'));
      return;
    }

    // Check if target manager has enough budget
    const managerRef = ref(database, `managers/${selectedManager.id}`);
    const managerSnapshot = await get(managerRef);
    const targetManager = managerSnapshot.val();

    if (targetManager.budget < amount) {
      showAlert(t('error'), `${selectedManager.managerName} ${t('doesNotHaveEnoughBudget')}`);
      return;
    }

    showConfirm(
      t('requestLoan'),
      `${t('requestLoanFrom')} ${selectedManager.managerName} ${t('for')} ${formatCurrency(amount)}?\n\n${t('noInterest')}`,
      async () => {
        const loansRef = ref(database, 'loans');
        const newLoanRef = await push(loansRef);

        const loan = {
          type: 'p2p',
          borrowerId: currentUser.uid,
          borrowerName: managerProfile.managerName,
          lenderId: selectedManager.id,
          lenderName: selectedManager.managerName,
          amount: amount,
          remaining: amount,
          status: 'pending',
          createdAt: Date.now()
        };

        await update(ref(database, `loans/${newLoanRef.key}`), loan);

        // Send notification to lender
        await push(ref(database, `managers/${selectedManager.id}/notifications`), {
          type: 'loan_request',
          from: managerProfile.managerName,
          fromId: currentUser.uid,
          amount: amount,
          message: `${managerProfile.managerName} is requesting a loan of ${formatCurrency(amount)} from you.`,
          loanId: newLoanRef.key,
          timestamp: Date.now(),
          read: false
        });

        setP2pLoanAmount('');
        setSelectedManager(null);
        setSearchQuery('');
        setSearchResults([]);
        loadManagerLoans();
        showAlert(t('success'), t('loanRequestSent'));
      }
    );
  };

  const handlePayInstallment = async (loan) => {
    if (managerProfile.budget < loan.installment) {
      showAlert(t('error'), t('notEnoughBudget'));
      return;
    }

    const newRemaining = loan.remaining - loan.installment;
    const isFullyPaid = newRemaining <= 0;

    showConfirm(
      t('payInstallment'),
      `${t('pay')} ${formatCurrency(loan.installment)}?\n${t('remaining')}: ${formatCurrency(Math.max(0, newRemaining))}`,
      async () => {
        await update(ref(database, `loans/${loan.id}`), {
          remaining: Math.max(0, newRemaining),
          nextPayment: isFullyPaid ? null : calculateNextPayment(loan.period),
          status: isFullyPaid ? 'paid' : 'active'
        });

        await updateManagerProfile({
          budget: managerProfile.budget - loan.installment
        });

        loadManagerLoans();
        showAlert(t('success'), isFullyPaid ? t('loanFullyPaid') : t('installmentPaid'));
      }
    );
  };

  const handlePayFullLoan = async (loan) => {
    if (managerProfile.budget < loan.remaining) {
      showAlert(t('error'), t('notEnoughBudget'));
      return;
    }

    showConfirm(
      t('payFullLoan'),
      `${t('payFull')} ${formatCurrency(loan.remaining)}?`,
      async () => {
        await update(ref(database, `loans/${loan.id}`), {
          remaining: 0,
          nextPayment: null,
          status: 'paid'
        });

        // If P2P loan, return money to lender
        if (loan.type === 'p2p' && loan.lenderId) {
          const lenderRef = ref(database, `managers/${loan.lenderId}`);
          const lenderSnapshot = await get(lenderRef);
          const lender = lenderSnapshot.val();

          await update(lenderRef, {
            budget: lender.budget + loan.remaining
          });
        }

        await updateManagerProfile({
          budget: managerProfile.budget - loan.remaining
        });

        loadManagerLoans();
        showAlert(t('success'), t('loanFullyPaid'));
      }
    );
  };

  if (!managerProfile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>{t('back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('bank')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </View>
    );
  }

  const activeBankLoan = managerLoans.find(
    loan => loan.type === 'bank' && loan.borrowerId === currentUser.uid && loan.status === 'active'
  );

  const myBorrowedLoans = managerLoans.filter(
    loan => loan.type === 'p2p' && loan.borrowerId === currentUser.uid && loan.status !== 'paid'
  );

  const myLentLoans = managerLoans.filter(
    loan => loan.type === 'p2p' && loan.lenderId === currentUser.uid && loan.status !== 'paid'
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🏦 {t('bank')}</Text>
        <Text style={styles.budget}>{t('budget')}: {formatCurrency(managerProfile.budget)}</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Bank Loan Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💰 {t('bankLoan')}</Text>

          {!activeBankLoan ? (
            <>
              <View style={styles.infoCard}>
                <Text style={styles.infoText}>{t('bankLoanDesc')}</Text>
              </View>

              <View style={styles.inputCard}>
                <Text style={styles.inputLabel}>{t('loanAmount')} (max {formatCurrency(MAX_LOAN_AMOUNT)})</Text>
                <TextInput
                  style={styles.input}
                  value={loanAmount}
                  onChangeText={setLoanAmount}
                  placeholder="0"
                  placeholderTextColor="#888"
                  keyboardType="numeric"
                />

                <Text style={styles.inputLabel}>{t('repaymentPeriod')}</Text>
                <View style={styles.periodButtons}>
                  <TouchableOpacity
                    style={[styles.periodButton, repaymentPeriod === 'daily' && styles.periodButtonActive]}
                    onPress={() => setRepaymentPeriod('daily')}
                  >
                    <Text style={[styles.periodButtonText, repaymentPeriod === 'daily' && styles.periodButtonTextActive]}>
                      {t('daily')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.periodButton, repaymentPeriod === 'weekly' && styles.periodButtonActive]}
                    onPress={() => setRepaymentPeriod('weekly')}
                  >
                    <Text style={[styles.periodButtonText, repaymentPeriod === 'weekly' && styles.periodButtonTextActive]}>
                      {t('weekly')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.periodButton, repaymentPeriod === 'monthly' && styles.periodButtonActive]}
                    onPress={() => setRepaymentPeriod('monthly')}
                  >
                    <Text style={[styles.periodButtonText, repaymentPeriod === 'monthly' && styles.periodButtonTextActive]}>
                      {t('monthly')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {loanAmount && parseInt(loanAmount) > 0 && (
                  <View style={styles.calculationCard}>
                    <Text style={styles.calculationText}>
                      {t('installment')}: {formatCurrency(calculateInstallment(parseInt(loanAmount), repaymentPeriod))} {repaymentPeriod === 'daily' ? t('daily') : repaymentPeriod === 'weekly' ? t('weekly') : t('monthly')}
                    </Text>
                    <Text style={styles.calculationSubtext}>{t('noInterest')} • 6 {t('months')}</Text>
                  </View>
                )}

                <TouchableOpacity style={styles.submitButton} onPress={handleBankLoan}>
                  <Text style={styles.submitButtonText}>{t('getLoan')}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.activeLoanCard}>
              <Text style={styles.activeLoanTitle}>{t('activeLoan')}</Text>
              <View style={styles.loanDetails}>
                <Text style={styles.loanDetailText}>{t('totalAmount')}: {formatCurrency(activeBankLoan.amount)}</Text>
                <Text style={styles.loanDetailText}>{t('remaining')}: {formatCurrency(activeBankLoan.remaining)}</Text>
                <Text style={styles.loanDetailText}>
                  {t('installment')}: {formatCurrency(activeBankLoan.installment)} {
                    activeBankLoan.period === 'daily' ? t('daily') :
                    activeBankLoan.period === 'weekly' ? t('weekly') : t('monthly')
                  }
                </Text>
                {activeBankLoan.nextPayment && (
                  <Text style={styles.loanDetailText}>
                    {t('nextPayment')}: {new Date(activeBankLoan.nextPayment).toLocaleDateString()}
                  </Text>
                )}
              </View>
              <View style={styles.loanActions}>
                <TouchableOpacity
                  style={styles.payButton}
                  onPress={() => handlePayInstallment(activeBankLoan)}
                >
                  <Text style={styles.payButtonText}>{t('payInstallment')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.payFullButton}
                  onPress={() => handlePayFullLoan(activeBankLoan)}
                >
                  <Text style={styles.payFullButtonText}>{t('payFull')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* P2P Loans Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👥 {t('managerLoans')}</Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoText}>{t('managerLoansDesc')}</Text>
          </View>

          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>{t('searchManager')}</Text>
            <TextInput
              style={styles.input}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('enterManagerName')}
              placeholderTextColor="#888"
            />

            {searchResults.length > 0 && (
              <ScrollView style={styles.searchResults} nestedScrollEnabled>
                {searchResults.map(manager => (
                  <TouchableOpacity
                    key={manager.id}
                    style={[
                      styles.managerResult,
                      selectedManager?.id === manager.id && styles.managerResultSelected
                    ]}
                    onPress={() => {
                      setSelectedManager(manager);
                      setSearchQuery(manager.managerName);
                      setSearchResults([]);
                    }}
                  >
                    <Text style={styles.managerName}>{manager.managerName}</Text>
                    <Text style={styles.managerBudget}>{formatCurrency(manager.budget || 0)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {selectedManager && (
              <>
                <Text style={styles.inputLabel}>{t('loanAmount')}</Text>
                <TextInput
                  style={styles.input}
                  value={p2pLoanAmount}
                  onChangeText={setP2pLoanAmount}
                  placeholder="0"
                  placeholderTextColor="#888"
                  keyboardType="numeric"
                />

                <TouchableOpacity style={styles.submitButton} onPress={handleP2PLoanRequest}>
                  <Text style={styles.submitButtonText}>{t('requestLoan')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* My Borrowed Loans */}
          {myBorrowedLoans.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>{t('myBorrowedLoans')}</Text>
              {myBorrowedLoans.map(loan => (
                <View key={loan.id} style={styles.loanCard}>
                  <View style={styles.loanHeader}>
                    <Text style={styles.loanTitle}>{t('from')}: {loan.lenderName}</Text>
                    <Text style={[styles.loanStatus, loan.status === 'pending' && styles.loanStatusPending]}>
                      {loan.status === 'pending' ? t('pending') : t('active')}
                    </Text>
                  </View>
                  <Text style={styles.loanAmount}>{formatCurrency(loan.amount)}</Text>
                  <Text style={styles.loanRemaining}>{t('remaining')}: {formatCurrency(loan.remaining)}</Text>
                  {loan.status === 'active' && (
                    <TouchableOpacity
                      style={styles.payFullButton}
                      onPress={() => handlePayFullLoan(loan)}
                    >
                      <Text style={styles.payFullButtonText}>{t('payBack')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </>
          )}

          {/* My Lent Loans */}
          {myLentLoans.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>{t('myLentLoans')}</Text>
              {myLentLoans.map(loan => (
                <View key={loan.id} style={styles.loanCard}>
                  <View style={styles.loanHeader}>
                    <Text style={styles.loanTitle}>{t('to')}: {loan.borrowerName}</Text>
                    <Text style={[styles.loanStatus, loan.status === 'pending' && styles.loanStatusPending]}>
                      {loan.status === 'pending' ? t('pending') : t('active')}
                    </Text>
                  </View>
                  <Text style={styles.loanAmount}>{formatCurrency(loan.amount)}</Text>
                  <Text style={styles.loanRemaining}>{t('remaining')}: {formatCurrency(loan.remaining)}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e27',
  },
  header: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: 15,
    paddingTop: 20,
  },
  backButton: {
    marginBottom: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  budget: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#667eea',
    marginTop: 15,
    marginBottom: 10,
  },
  infoCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  infoText: {
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 20,
  },
  inputCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  inputLabel: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#252b54',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  periodButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  periodButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#252b54',
    borderWidth: 2,
    borderColor: '#2d3561',
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  periodButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  periodButtonTextActive: {
    color: '#ffffff',
  },
  calculationCard: {
    backgroundColor: '#252b54',
    borderRadius: 10,
    padding: 12,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#43e97b',
  },
  calculationText: {
    fontSize: 16,
    color: '#43e97b',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  calculationSubtext: {
    fontSize: 12,
    color: '#888',
  },
  submitButton: {
    backgroundColor: '#43e97b',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 15,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  activeLoanCard: {
    backgroundColor: '#1a3a2d',
    borderRadius: 15,
    padding: 15,
    borderWidth: 2,
    borderColor: '#43e97b',
  },
  activeLoanTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#43e97b',
    marginBottom: 10,
  },
  loanDetails: {
    marginBottom: 15,
  },
  loanDetailText: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 5,
  },
  loanActions: {
    flexDirection: 'row',
    gap: 10,
  },
  payButton: {
    flex: 1,
    backgroundColor: '#667eea',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  payButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  payFullButton: {
    flex: 1,
    backgroundColor: '#43e97b',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  payFullButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  searchResults: {
    maxHeight: 200,
    marginTop: 10,
  },
  managerResult: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#252b54',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  managerResultSelected: {
    borderColor: '#43e97b',
    backgroundColor: '#1a3a2d',
  },
  managerName: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  managerBudget: {
    fontSize: 14,
    color: '#43e97b',
  },
  loanCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  loanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  loanTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  loanStatus: {
    fontSize: 12,
    color: '#43e97b',
    fontWeight: 'bold',
  },
  loanStatusPending: {
    color: '#f5576c',
  },
  loanAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 5,
  },
  loanRemaining: {
    fontSize: 14,
    color: '#888',
    marginBottom: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: 'bold',
  },
});

export default Bank;
