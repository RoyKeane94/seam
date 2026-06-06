import { Component } from 'react';
import { reportClientError } from '../api';
import ErrorPage from '../pages/ErrorPage';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this.handleRetry = this.handleRetry.bind(this);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    reportClientError({
      message: error?.message || 'Unknown client error',
      stack: error?.stack || '',
      path: window.location.pathname,
      component: info?.componentStack?.slice(0, 2000) || '',
    });
  }

  handleRetry() {
    this.setState({ hasError: false });
  }

  render() {
    if (this.state.hasError) {
      return <ErrorPage onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}
