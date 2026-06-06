from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    invite_code = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('email', 'password', 'first_name', 'last_name', 'invite_code')
        extra_kwargs = {
            'first_name': {'required': False, 'allow_blank': True},
            'last_name': {'required': False, 'allow_blank': True},
        }

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate_invite_code(self, value):
        required = getattr(settings, 'INVITE_CODE', '')
        if required and value.strip() != required:
            raise serializers.ValidationError('Invalid invite code.')
        return value.strip()

    def create(self, validated_data):
        validated_data.pop('invite_code')
        return User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'email', 'created_at')
        read_only_fields = fields
